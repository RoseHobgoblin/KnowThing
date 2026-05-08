/**
 * Phase 6 migration: extract prose from `content_records` (domain='calendar')
 * shadow articles into the matching `calendars.body`.
 *
 * Usage:
 *   DATABASE_URL=... node --experimental-strip-types scripts/migrate-calendar-prose.ts          # dry run
 *   DATABASE_URL=... node --experimental-strip-types scripts/migrate-calendar-prose.ts --apply  # mutate
 */

import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error('FATAL: DATABASE_URL not set')
	process.exit(1)
}

const sql = postgres(DATABASE_URL)

interface CalendarRecord {
	id: number
	slug: string
	title: string
	content: string
	parsedAst: unknown
	plainText: string
	sizeBytes: number
	updatedAt: Date
}

async function main() {
	console.log(APPLY ? '🚀 APPLY mode' : '🧪 DRY RUN (use --apply to mutate)')
	console.log('-'.repeat(60))

	const records = await sql<CalendarRecord[]>`
		SELECT id, slug, title, content,
			parsed_ast AS "parsedAst",
			plain_text AS "plainText",
			size_bytes AS "sizeBytes",
			updated_at AS "updatedAt"
		FROM content_records
		WHERE domain = 'calendar'
		ORDER BY id
	`

	console.log(`Found ${records.length} calendar content_records to migrate.\n`)

	let migrated = 0, skipped = 0, errors = 0

	for (const record of records) {
		const [cal] = await sql<{ id: number, slug: string, bodyLen: number }[]>`
			SELECT id, slug, char_length(body) AS "bodyLen" FROM calendars
			WHERE LOWER(slug) = LOWER(${record.slug})
			LIMIT 1
		`
		if (!cal) {
			console.warn(`  ⚠ no calendar matches content_records.id=${record.id} slug=${record.slug}`)
			skipped++
			continue
		}

		if (cal.bodyLen > 0 && record.content.length > 0) {
			console.warn(`  ⚠ calendar ${cal.slug} already has body content; skipping content_records.id=${record.id}`)
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

		console.log(`  → calendar ${cal.slug} (entity_id=${cal.id}) ⇐ content_records.id=${record.id}`)
		console.log(`      ${record.content.length} chars of prose, ${revs.length} revisions`)

		if (!APPLY) {
			migrated++
			continue
		}

		try {
			await sql.begin(async (tx) => {
				if (record.content.length > 0 && cal.bodyLen === 0) {
					await tx`
						UPDATE calendars SET
							body            = ${record.content},
							body_parsed_ast = ${sql.json(record.parsedAst as Record<string, unknown>)},
							body_plain_text = ${record.plainText},
							body_size_bytes = ${record.sizeBytes},
							body_updated_at = ${record.updatedAt}
						WHERE id = ${cal.id}
					`
				}

				for (const rev of revs) {
					await tx`
						INSERT INTO entity_revisions
							(entity_type, entity_id, title, snapshot, edit_summary, user_id, created_at)
						VALUES
							('calendar', ${cal.id}, ${rev.title},
								${sql.json({ title: rev.title, content: rev.content, sizeBytes: rev.sizeBytes, editSummary: rev.editSummary })},
								${rev.editSummary}, ${rev.userId}, ${rev.createdAt})
					`
				}

				await tx`
					UPDATE content_links
					SET source_kind = 'calendar',
						source_entity_id = ${cal.id},
						source_id = NULL
					WHERE source_id = ${record.id}
				`

				await tx`
					UPDATE content_links
					SET target_domain = 'calendar',
						target_slug = ${cal.slug},
						target_id = NULL
					WHERE target_domain = 'know'
						AND LOWER(target_slug) = LOWER(${record.slug})
				`

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

await main()
