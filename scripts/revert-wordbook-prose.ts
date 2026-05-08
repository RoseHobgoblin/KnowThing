/**
 * Reverse-migration: move prose out of `languages.body` / `lexicon.body` BACK
 * into `content_records` (domain='know') so the wordbook UI can stop being a
 * pseudo-wiki. The wordbook is a dictionary; long-form prose belongs in Know.
 *
 * Per-row strategy (only rows with `body` length > 0):
 *   1. Determine target Know slug. Prefer `page_slug` if set; otherwise derive
 *      from the row's identifier ("Oncheran_language" / the lexicon word).
 *   2. UPSERT a content_records row at (domain='know', slug=<targetSlug>).
 *      If one already exists with non-empty content, append-warn and skip
 *      (don't clobber).
 *   3. Copy body → content, body_parsed_ast → parsed_ast, body_plain_text →
 *      plain_text, body_size_bytes → size_bytes, body_updated_at → updated_at.
 *   4. Copy `entity_revisions` rows for this entity back to
 *      `content_revisions` for the new content_records row.
 *   5. Repoint inbound `content_links` from
 *      (target_domain='wordbook', target_slug=<entity_slug or lang/word>) to
 *      (target_domain='know', target_slug=<targetSlug>).
 *   6. Repoint outbound `content_links` from
 *      (source_kind='language'|'lexicon', source_entity_id=<id>) to
 *      (source_kind='know', source_entity_id=<new cr.id>, source_id=<new cr.id>).
 *   7. NULL out body fields on the entity row, persist `page_slug` if it was
 *      derived (so the UI can still link back).
 *   8. Delete `entity_revisions` rows for that entity (already copied).
 *
 * Idempotent. Single transaction per row.
 */

import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error('FATAL: DATABASE_URL not set')
	process.exit(1)
}

const sql = postgres(DATABASE_URL)

interface LangRow {
	id: number
	slug: string
	pageSlug: string | null
	body: string
	bodyParsedAst: unknown
	bodyPlainText: string
	bodySizeBytes: number
	bodyUpdatedAt: Date | null
}

interface LexRow {
	id: number
	word: string
	languageSlug: string
	pageSlug: string | null
	body: string
	bodyParsedAst: unknown
	bodyPlainText: string
	bodySizeBytes: number
	bodyUpdatedAt: Date | null
}

async function main() {
	console.log(APPLY ? '🚀 APPLY mode' : '🧪 DRY RUN (use --apply to mutate)')
	console.log('-'.repeat(60))

	const languages = await sql<LangRow[]>`
		SELECT id, slug,
			page_slug      AS "pageSlug",
			body,
			body_parsed_ast AS "bodyParsedAst",
			body_plain_text AS "bodyPlainText",
			body_size_bytes AS "bodySizeBytes",
			body_updated_at AS "bodyUpdatedAt"
		FROM languages
		WHERE char_length(body) > 0
		ORDER BY id
	`

	const lexicon = await sql<LexRow[]>`
		SELECT lex.id, lex.word,
			lg.slug          AS "languageSlug",
			lex.page_slug    AS "pageSlug",
			lex.body,
			lex.body_parsed_ast AS "bodyParsedAst",
			lex.body_plain_text AS "bodyPlainText",
			lex.body_size_bytes AS "bodySizeBytes",
			lex.body_updated_at AS "bodyUpdatedAt"
		FROM lexicon lex
		JOIN languages lg ON lg.id = lex.language_id
		WHERE char_length(lex.body) > 0
		ORDER BY lex.id
	`

	console.log(`Found ${languages.length} languages and ${lexicon.length} lexicon entries with body content.\n`)

	let migrated = 0, skipped = 0, errors = 0

	for (const lang of languages) {
		try {
			const targetSlug = lang.pageSlug || `${capitalise(lang.slug)}_language`
			console.log(`  → language ${lang.slug} (id=${lang.id}) ⇒ /know/${targetSlug}`)
			console.log(`      ${lang.bodyPlainText.length} chars plain, ${lang.bodySizeBytes} bytes`)
			if (!APPLY) { migrated++; continue }
			await migrateRow(tx => migrateLanguage(tx, lang, targetSlug))
			migrated++
		} catch (e) {
			console.error(`  ✗ FAILED for language ${lang.slug}:`, e)
			errors++
		}
	}

	for (const lex of lexicon) {
		try {
			const targetSlug = lex.pageSlug || lex.word.replaceAll(/\s+/g, '_')
			console.log(`  → lexicon ${lex.languageSlug}/${lex.word} (id=${lex.id}) ⇒ /know/${targetSlug}`)
			console.log(`      ${lex.bodyPlainText.length} chars plain, ${lex.bodySizeBytes} bytes`)
			if (!APPLY) { migrated++; continue }
			await migrateRow(tx => migrateLexicon(tx, lex, targetSlug))
			migrated++
		} catch (e) {
			console.error(`  ✗ FAILED for lexicon ${lex.word}:`, e)
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

function capitalise(s: string): string {
	if (!s) return s
	return s[0].toUpperCase() + s.slice(1)
}

type Tx = Parameters<Parameters<typeof sql.begin>[0]>[0]

async function migrateRow(fn: (tx: Tx) => Promise<void>): Promise<void> {
	await sql.begin(fn)
}

async function migrateLanguage(tx: Tx, lang: LangRow, targetSlug: string): Promise<void> {
	const cr = await upsertKnowRecord(tx, targetSlug, lang)

	// Move entity_revisions back to content_revisions
	const revs = await tx`
		SELECT title, snapshot, edit_summary AS "editSummary", user_id AS "userId", created_at AS "createdAt"
		FROM entity_revisions
		WHERE entity_type = 'language' AND entity_id = ${lang.id}
		ORDER BY created_at
	`
	for (const rev of revs as Array<{ title: string, snapshot: { content?: string, sizeBytes?: number }, editSummary: string | null, userId: number | null, createdAt: Date }>) {
		const content = rev.snapshot?.content ?? ''
		const sizeBytes = rev.snapshot?.sizeBytes ?? 0
		await tx`
			INSERT INTO content_revisions
				(content_record_id, title, content, size_bytes, edit_summary, user_id, created_at)
			VALUES
				(${cr.id}, ${rev.title}, ${content}, ${sizeBytes}, ${rev.editSummary}, ${rev.userId}, ${rev.createdAt})
		`
	}

	// Repoint inbound content_links: (wordbook, lang.slug) → (know, targetSlug)
	await tx`
		UPDATE content_links
		SET target_domain = 'know', target_slug = ${targetSlug}, target_id = NULL
		WHERE target_domain = 'wordbook' AND LOWER(target_slug) = LOWER(${lang.slug})
	`

	// Repoint outbound content_links: language sources → know source on the new cr
	await tx`
		UPDATE content_links
		SET source_kind = 'know', source_entity_id = ${cr.id}, source_id = ${cr.id}
		WHERE source_kind = 'language' AND source_entity_id = ${lang.id}
	`

	// Set page_slug on the language row (so the UI's "See full article" link works)
	// and clear the body fields.
	await tx`
		UPDATE languages
		SET page_slug = ${targetSlug},
			body = '',
			body_parsed_ast = NULL,
			body_plain_text = '',
			body_size_bytes = 0,
			body_updated_at = NULL
		WHERE id = ${lang.id}
	`

	// Drop the entity_revisions rows we just copied.
	await tx`DELETE FROM entity_revisions WHERE entity_type = 'language' AND entity_id = ${lang.id}`
}

async function migrateLexicon(tx: Tx, lex: LexRow, targetSlug: string): Promise<void> {
	const cr = await upsertKnowRecord(tx, targetSlug, lex)

	const revs = await tx`
		SELECT title, snapshot, edit_summary AS "editSummary", user_id AS "userId", created_at AS "createdAt"
		FROM entity_revisions
		WHERE entity_type = 'lexicon' AND entity_id = ${lex.id}
		ORDER BY created_at
	`
	for (const rev of revs as Array<{ title: string, snapshot: { content?: string, sizeBytes?: number }, editSummary: string | null, userId: number | null, createdAt: Date }>) {
		const content = rev.snapshot?.content ?? ''
		const sizeBytes = rev.snapshot?.sizeBytes ?? 0
		await tx`
			INSERT INTO content_revisions
				(content_record_id, title, content, size_bytes, edit_summary, user_id, created_at)
			VALUES
				(${cr.id}, ${rev.title}, ${content}, ${sizeBytes}, ${rev.editSummary}, ${rev.userId}, ${rev.createdAt})
		`
	}

	// Repoint inbound: (wordbook, "<lang>/<word>") → (know, targetSlug).
	const wordbookSlug = `${lex.languageSlug}/${lex.word}`
	await tx`
		UPDATE content_links
		SET target_domain = 'know', target_slug = ${targetSlug}, target_id = NULL
		WHERE target_domain = 'wordbook' AND LOWER(target_slug) = LOWER(${wordbookSlug})
	`

	// Repoint outbound
	await tx`
		UPDATE content_links
		SET source_kind = 'know', source_entity_id = ${cr.id}, source_id = ${cr.id}
		WHERE source_kind = 'lexicon' AND source_entity_id = ${lex.id}
	`

	await tx`
		UPDATE lexicon
		SET page_slug = ${targetSlug},
			body = '',
			body_parsed_ast = NULL,
			body_plain_text = '',
			body_size_bytes = 0,
			body_updated_at = NULL
		WHERE id = ${lex.id}
	`

	await tx`DELETE FROM entity_revisions WHERE entity_type = 'lexicon' AND entity_id = ${lex.id}`
}

interface BodyHolder {
	body: string
	bodyParsedAst: unknown
	bodyPlainText: string
	bodySizeBytes: number
	bodyUpdatedAt: Date | null
}

async function upsertKnowRecord(tx: Tx, slug: string, body: BodyHolder): Promise<{ id: number }> {
	const existing = await tx`
		SELECT id, char_length(content) AS "contentLen"
		FROM content_records
		WHERE domain = 'know' AND LOWER(slug) = LOWER(${slug})
		LIMIT 1
	`
	const existingRow = (existing as Array<{ id: number, contentLen: number }>)[0]

	if (existingRow && existingRow.contentLen > 0) {
		throw new Error(`content_records.know.${slug} already has content; refusing to clobber`)
	}

	const title = slug.replaceAll('_', ' ')
	if (existingRow) {
		await tx`
			UPDATE content_records
			SET content = ${body.body},
				parsed_ast = ${sql.json(body.bodyParsedAst as Record<string, unknown>)},
				plain_text = ${body.bodyPlainText},
				size_bytes = ${body.bodySizeBytes},
				updated_at = ${body.bodyUpdatedAt ?? new Date()},
				title = ${title}
			WHERE id = ${existingRow.id}
		`
		return { id: existingRow.id }
	}

	const inserted = await tx`
		INSERT INTO content_records
			(domain, slug, title, content, plain_text, parsed_ast, size_bytes, updated_at)
		VALUES
			('know', ${slug}, ${title}, ${body.body}, ${body.bodyPlainText},
				${sql.json(body.bodyParsedAst as Record<string, unknown>)},
				${body.bodySizeBytes}, ${body.bodyUpdatedAt ?? new Date()})
		RETURNING id
	`
	return { id: (inserted as Array<{ id: number }>)[0].id }
}

await main()
