/**
 * Phase 4 migration script: extract prose from `content_records` (domain='rodder')
 * into the structured row's body field. Idempotent — safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=... node --env-file=.env --loader ts-node/esm scripts/migrate-rodder-prose.ts        # dry-run
 *   DATABASE_URL=... node --env-file=.env --loader ts-node/esm scripts/migrate-rodder-prose.ts --apply  # actually mutate
 *
 * For each rodder content_records row:
 *   1. Find matching entity (system → star → planet) by slug or pageSlug.
 *   2. Copy content/parsedAst/plainText/sizeBytes/updatedAt → entity.body_*.
 *   3. Copy content_revisions → entity_revisions (entity_type, entity_id, snapshot).
 *   4. Repoint outbound content_links: source_kind='star'|'planet'|'system',
 *      source_entity_id=<entity.id>, source_id=NULL.
 *   5. Repoint inbound content_links targeting this slug under domain='know':
 *      they stay as `targetDomain='rodder', targetSlug=<entity.slug>` so the
 *      resolver finds them at the new home.
 *   6. Delete the source content_records row (and cascade content_revisions).
 *
 * Safety: wrapped in a single transaction. Aborts on any error.
 */

import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error('FATAL: DATABASE_URL not set')
	process.exit(1)
}

const sql = postgres(DATABASE_URL)

interface RodderRecord {
	id: number
	slug: string
	title: string
	content: string
	parsedAst: unknown
	plainText: string
	sizeBytes: number
	updatedAt: Date
}

interface EntityMatch {
	kind: 'system' | 'star' | 'planet'
	table: 'star_systems' | 'stars' | 'planetary_bodies'
	id: number
	slug: string
	bodyAlreadyPopulated: boolean
}

async function main() {
	console.log(APPLY ? '🚀 APPLY mode' : '🧪 DRY RUN mode (use --apply to mutate)')
	console.log('-'.repeat(60))

	const records = await sql<RodderRecord[]>`
		SELECT id, slug, title, content,
			parsed_ast    AS "parsedAst",
			plain_text    AS "plainText",
			size_bytes    AS "sizeBytes",
			updated_at    AS "updatedAt"
		FROM content_records
		WHERE domain = 'rodder'
		ORDER BY id
	`

	console.log(`Found ${records.length} rodder content_records to migrate.\n`)

	let migrated = 0
	let skipped = 0
	let errors = 0

	for (const record of records) {
		const match = await findEntityMatch(record.slug)
		if (!match) {
			console.warn(`  ⚠ No matching rodder entity for content_records.id=${record.id} slug=${record.slug}; skipping`)
			skipped++
			continue
		}

		if (match.bodyAlreadyPopulated && record.content.length > 0) {
			console.warn(`  ⚠ ${match.kind} ${match.slug} (id=${match.id}) already has body content; would overwrite. Skipping content_records.id=${record.id}`)
			skipped++
			continue
		}

		const revs = await sql<{ id: number, title: string, content: string, sizeBytes: number, editSummary: string | null, userId: number | null, createdAt: Date }[]>`
			SELECT id, title, content,
				size_bytes  AS "sizeBytes",
				edit_summary AS "editSummary",
				user_id     AS "userId",
				created_at  AS "createdAt"
			FROM content_revisions
			WHERE content_record_id = ${record.id}
			ORDER BY created_at
		`

		console.log(`  → ${match.kind} ${match.slug} (entity_id=${match.id}) ⇐ content_records.id=${record.id}`)
		console.log(`      ${record.content.length} chars of prose, ${revs.length} revisions`)

		if (!APPLY) {
			migrated++
			continue
		}

		try {
			await sql.begin(async (tx) => {
				// 1. Write body to entity row (only if record has content; skip for empty
				//    stub records pointing at an already-populated entity).
				if (record.content.length > 0 && !match.bodyAlreadyPopulated) {
					await tx.unsafe(
						`UPDATE ${match.table} SET
							body            = $1,
							body_parsed_ast = $2,
							body_plain_text = $3,
							body_size_bytes = $4,
							body_updated_at = $5
						WHERE id = $6`,
						[
							record.content,
							record.parsedAst as never,
							record.plainText,
							record.sizeBytes,
							record.updatedAt,
							match.id,
						],
					)
				}

				// 2. Copy revisions
				for (const rev of revs) {
					await tx`
						INSERT INTO entity_revisions
							(entity_type, entity_id, title, snapshot, edit_summary, user_id, created_at)
						VALUES
							(${match.kind}, ${match.id}, ${rev.title},
								${sql.json({ title: rev.title, content: rev.content, sizeBytes: rev.sizeBytes, editSummary: rev.editSummary })},
								${rev.editSummary}, ${rev.userId}, ${rev.createdAt})
					`
				}

				// 3. Repoint OUTBOUND content_links: this content_record was the source
				await tx`
					UPDATE content_links
					SET source_kind = ${match.kind},
						source_entity_id = ${match.id},
						source_id = NULL
					WHERE source_id = ${record.id}
				`

				// 4. INBOUND links: any content_links pointing at (targetDomain='know',
				//    targetSlug=<entity.slug>) should retarget to (rodder, slug). The
				//    Phase 0 audit shows old Know-domain links pointing at things like
				//    "Sun" / "Therne" — keep them resolving by retargeting them.
				await tx`
					UPDATE content_links
					SET target_domain = 'rodder',
						target_slug = ${match.slug},
						target_id = NULL
					WHERE target_domain = 'know'
						AND LOWER(target_slug) = LOWER(${record.slug})
				`

				// 5. Delete the source content_records (cascades content_revisions)
				await tx`DELETE FROM content_records WHERE id = ${record.id}`
			})

			migrated++
		} catch (error) {
			console.error(`  ✗ FAILED for content_records.id=${record.id}:`, error)
			errors++
		}
	}

	console.log('-'.repeat(60))
	console.log(`Migrated:  ${migrated}`)
	console.log(`Skipped:   ${skipped}`)
	console.log(`Errors:    ${errors}`)

	if (!APPLY) console.log('\n(dry run — re-run with --apply to mutate)')

	await sql.end()
	process.exit(errors > 0 ? 1 : 0)
}

async function findEntityMatch(slug: string): Promise<EntityMatch | null> {
	const lower = slug.toLowerCase()

	const systems = await sql<{ id: number, slug: string, bodyLen: number }[]>`
		SELECT id, slug, char_length(body) AS "bodyLen" FROM star_systems
		WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		LIMIT 1
	`
	if (systems[0]) {
		return { kind: 'system', table: 'star_systems', id: systems[0].id, slug: systems[0].slug, bodyAlreadyPopulated: systems[0].bodyLen > 0 }
	}

	const starsRows = await sql<{ id: number, slug: string, bodyLen: number }[]>`
		SELECT id, slug, char_length(body) AS "bodyLen" FROM stars
		WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		LIMIT 1
	`
	if (starsRows[0]) {
		return { kind: 'star', table: 'stars', id: starsRows[0].id, slug: starsRows[0].slug, bodyAlreadyPopulated: starsRows[0].bodyLen > 0 }
	}

	const planets = await sql<{ id: number, slug: string, bodyLen: number }[]>`
		SELECT id, slug, char_length(body) AS "bodyLen" FROM planetary_bodies
		WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		LIMIT 1
	`
	if (planets[0]) {
		return { kind: 'planet', table: 'planetary_bodies', id: planets[0].id, slug: planets[0].slug, bodyAlreadyPopulated: planets[0].bodyLen > 0 }
	}

	return null
}

await main()
