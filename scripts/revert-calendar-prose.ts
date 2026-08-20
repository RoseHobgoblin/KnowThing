/**
 * Reverse-migration: move prose out of `calendars.body` BACK into
 * `content_records` (domain='know'). Mirror of revert-rodder-prose.ts /
 * revert-wordbook-prose.ts. Calendars don't carry a page_slug column, so the
 * Know slug derives from the calendar name (spaces → underscores).
 *
 * Per-row strategy (only rows with `body` length > 0):
 *   1. targetSlug = name.replace(/\s+/g, '_').
 *   2. UPSERT content_records row (domain='know', slug=<targetSlug>). Refuse
 *      to clobber if a non-empty Know record already exists at that slug.
 *   3. Copy entity_revisions(entity_type='calendar', entity_id=<id>) → content_revisions.
 *   4. Repoint INBOUND content_links: (calendar, calendar.slug) → (know, targetSlug).
 *   5. Repoint OUTBOUND content_links: (calendar, id) → (know, cr.id).
 *   6. NULL the body fields on calendars row.
 *   7. Delete entity_revisions for that calendar.
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

interface CalRow {
	id: number
	slug: string
	name: string
	body: string
	bodyParsedAst: unknown
	bodyPlainText: string
	bodySizeBytes: number
	bodyUpdatedAt: Date | null
}

async function main() {
	console.log(APPLY ? '🚀 APPLY mode' : '🧪 DRY RUN (use --apply to mutate)')
	console.log('-'.repeat(60))

	const cals = await sql<CalRow[]>`
		SELECT id, slug, name, body,
			body_parsed_ast AS "bodyParsedAst",
			body_plain_text AS "bodyPlainText",
			body_size_bytes AS "bodySizeBytes",
			body_updated_at AS "bodyUpdatedAt"
		FROM calendars
		WHERE char_length(body) > 0
		ORDER BY id
	`

	console.log(`Found ${cals.length} calendars with body content.\n`)

	let migrated = 0, errors = 0

	for (const cal of cals) {
		try {
			const targetSlug = cal.name.replaceAll(/\s+/g, '_')
			console.log(`  → calendar ${cal.slug} (id=${cal.id}) ⇒ /know/${targetSlug}`)
			console.log(`      ${cal.bodyPlainText.length} chars plain, ${cal.bodySizeBytes} bytes`)
			if (!APPLY) { migrated++; continue }
			await sql.begin(tx => migrateOne(tx, cal, targetSlug))
			migrated++
		} catch (error) {
			console.error(`  ✗ FAILED for calendar ${cal.slug}:`, error)
			errors++
		}
	}

	console.log('-'.repeat(60))
	console.log(`Migrated:  ${migrated}`)
	console.log(`Errors:    ${errors}`)
	if (!APPLY) console.log('\n(dry run — re-run with --apply to mutate)')

	await sql.end()
	process.exit(errors > 0 ? 1 : 0)
}

type Tx = Parameters<Parameters<typeof sql.begin>[0]>[0]

async function migrateOne(tx: Tx, cal: CalRow, targetSlug: string): Promise<void> {
	const cr = await upsertKnowRecord(tx, targetSlug, cal)

	const revs = await tx`
		SELECT title, snapshot, edit_summary AS "editSummary", user_id AS "userId", created_at AS "createdAt"
		FROM entity_revisions
		WHERE entity_type = 'calendar' AND entity_id = ${cal.id}
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

	await tx`
		UPDATE content_links
		SET target_domain = 'know', target_slug = ${targetSlug}, target_id = NULL
		WHERE target_domain = 'calendar' AND LOWER(target_slug) = LOWER(${cal.slug})
	`

	await tx`
		UPDATE content_links
		SET source_kind = 'know', source_entity_id = ${cr.id}, source_id = ${cr.id}
		WHERE source_kind = 'calendar' AND source_entity_id = ${cal.id}
	`

	await tx`
		UPDATE calendars
		SET body = '',
			body_parsed_ast = NULL,
			body_plain_text = '',
			body_size_bytes = 0,
			body_updated_at = NULL
		WHERE id = ${cal.id}
	`

	await tx`DELETE FROM entity_revisions WHERE entity_type = 'calendar' AND entity_id = ${cal.id}`
}

async function upsertKnowRecord(tx: Tx, slug: string, body: CalRow): Promise<{ id: number }> {
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
