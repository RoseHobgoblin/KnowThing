/**
 * Phase 5 migration: extract prose from `content_records` (domain='know')
 * shadow articles into the matching language or lexicon row's `body` field.
 *
 * Match strategy (case-insensitive):
 *   1. languages.page_slug == content_records.slug          (glued)
 *   2. languages.slug      == content_records.slug          (unglued)
 *   3. lexicon.page_slug   == content_records.slug          (glued)
 *   4. lexicon.word        == content_records.slug          (unglued — see Onchera elekoneta soft collision)
 *
 * Languages are checked before lexicon so a Know article matching both is
 * attributed to the language. (None do today — confirmed in audit.)
 *
 * Usage:
 *   bun --env-file=.env scripts/migrate-wordbook-prose.ts          # dry run
 *   bun --env-file=.env scripts/migrate-wordbook-prose.ts --apply  # mutate
 */

import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error('FATAL: DATABASE_URL not set')
	process.exit(1)
}

const sql = postgres(DATABASE_URL)

interface KnowRecord {
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
	kind: 'language' | 'lexicon'
	table: 'languages' | 'lexicon'
	id: number
	identifier: string // slug for languages, word for lexicon
	bodyAlreadyPopulated: boolean
}

async function main() {
	console.log(APPLY ? '🚀 APPLY mode' : '🧪 DRY RUN (use --apply to mutate)')
	console.log('-'.repeat(60))

	// Pull every Know record whose slug matches a language pageSlug/slug or a
	// lexicon pageSlug/word (case-insensitive). Done as one query so the same
	// content_record can't be matched twice.
	const candidates = await sql<KnowRecord[]>`
		SELECT DISTINCT cr.id, cr.slug, cr.title, cr.content,
			cr.parsed_ast AS "parsedAst",
			cr.plain_text AS "plainText",
			cr.size_bytes AS "sizeBytes",
			cr.updated_at AS "updatedAt"
		FROM content_records cr
		WHERE cr.domain = 'know'
			AND (
				EXISTS (SELECT 1 FROM languages WHERE LOWER(slug) = LOWER(cr.slug) OR LOWER(page_slug) = LOWER(cr.slug))
				OR EXISTS (SELECT 1 FROM lexicon WHERE LOWER(word) = LOWER(cr.slug) OR LOWER(page_slug) = LOWER(cr.slug))
			)
		ORDER BY cr.id
	`

	console.log(`Found ${candidates.length} content_records to migrate.\n`)

	let migrated = 0, skipped = 0, errors = 0

	for (const record of candidates) {
		const match = await findMatch(record.slug)
		if (!match) {
			console.warn(`  ⚠ no match for content_records.id=${record.id} slug=${record.slug}`)
			skipped++
			continue
		}

		if (match.bodyAlreadyPopulated && record.content.length > 0) {
			console.warn(`  ⚠ ${match.kind} ${match.identifier} already has body content; skipping content_records.id=${record.id}`)
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

		console.log(`  → ${match.kind} ${match.identifier} (entity_id=${match.id}) ⇐ content_records.id=${record.id}`)
		console.log(`      ${record.content.length} chars of prose, ${revs.length} revisions`)

		if (!APPLY) {
			migrated++
			continue
		}

		try {
			await sql.begin(async (tx) => {
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

				// Repoint outbound: this Know record was the source of links
				await tx`
					UPDATE content_links
					SET source_kind = ${match.kind},
						source_entity_id = ${match.id},
						source_id = NULL
					WHERE source_id = ${record.id}
				`

				// Repoint inbound: anything pointing at (know, this slug) should
				// now point at (wordbook, identifier). For lexicon, identifier is
				// `<lang.slug>/<word>` so resolveWordbookPath can find it.
				const targetSlug = await wordbookTargetSlug(match)
				await tx`
					UPDATE content_links
					SET target_domain = 'wordbook',
						target_slug = ${targetSlug},
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

async function findMatch(slug: string): Promise<EntityMatch | null> {
	const lower = slug.toLowerCase()

	const langs = await sql<{ id: number, slug: string, bodyLen: number }[]>`
		SELECT id, slug, char_length(body) AS "bodyLen" FROM languages
		WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		LIMIT 1
	`
	if (langs[0]) {
		return { kind: 'language', table: 'languages', id: langs[0].id, identifier: langs[0].slug, bodyAlreadyPopulated: langs[0].bodyLen > 0 }
	}

	const words = await sql<{ id: number, word: string, bodyLen: number }[]>`
		SELECT id, word, char_length(body) AS "bodyLen" FROM lexicon
		WHERE LOWER(word) = ${lower} OR LOWER(page_slug) = ${lower}
		LIMIT 1
	`
	if (words[0]) {
		return { kind: 'lexicon', table: 'lexicon', id: words[0].id, identifier: words[0].word, bodyAlreadyPopulated: words[0].bodyLen > 0 }
	}

	return null
}

async function wordbookTargetSlug(match: EntityMatch): Promise<string> {
	if (match.kind === 'language') return match.identifier
	const [row] = await sql<{ langSlug: string }[]>`
		SELECT lg.slug AS "langSlug"
		FROM lexicon lex
		JOIN languages lg ON lg.id = lex.language_id
		WHERE lex.id = ${match.id}
	`
	if (!row) return match.identifier
	return `${row.langSlug}/${match.identifier}`
}

await main()
