/**
 * Reverse-migration: move prose out of `stars.body` / `planetary_bodies.body` /
 * `star_systems.body` BACK into `content_records` (domain='know') so the
 * rodder UI becomes a pure structured-data view. Mirror of
 * revert-wordbook-prose.ts.
 *
 * Per-row strategy (only rows with `body` length > 0):
 *   1. Determine target Know slug. Prefer `page_slug` if set; otherwise derive
 *      from the row's `name` (spaces → underscores).
 *   2. UPSERT a content_records row at (domain='know', slug=<targetSlug>).
 *      If one already exists with non-empty content, abort that row (don't
 *      clobber).
 *   3. Copy body → content, body_parsed_ast → parsed_ast, body_plain_text →
 *      plain_text, body_size_bytes → size_bytes, body_updated_at → updated_at.
 *   4. Copy `entity_revisions` rows for this entity back to
 *      `content_revisions` for the new content_records row.
 *   5. Repoint inbound `content_links` from
 *      (target_domain='rodder', target_slug=<entity_slug>) to
 *      (target_domain='know', target_slug=<targetSlug>).
 *   6. Repoint outbound `content_links` from
 *      (source_kind='star'|'planet'|'system', source_entity_id=<id>) to
 *      (source_kind='know', source_entity_id=<new cr.id>, source_id=<new cr.id>).
 *   7. NULL out body fields on the entity row, persist `page_slug` if it was
 *      derived (so the UI can still link from the data view back to the Know
 *      article).
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

type EntityKind = 'system' | 'star' | 'planet'

interface EntityRow {
	kind: EntityKind
	table: 'star_systems' | 'stars' | 'planetary_bodies'
	id: number
	slug: string
	name: string
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

	const systems = await fetchEntities('system', 'star_systems')
	const stars = await fetchEntities('star', 'stars')
	const planets = await fetchEntities('planet', 'planetary_bodies')

	const all = [...systems, ...stars, ...planets]
	console.log(`Found ${systems.length} systems, ${stars.length} stars, ${planets.length} planets with body content.\n`)

	let migrated = 0, skipped = 0, errors = 0

	for (const row of all) {
		try {
			const targetSlug = row.pageSlug || row.name.replaceAll(/\s+/g, '_')
			console.log(`  → ${row.kind} ${row.slug} (id=${row.id}) ⇒ /know/${targetSlug}`)
			console.log(`      ${row.bodyPlainText.length} chars plain, ${row.bodySizeBytes} bytes`)
			if (!APPLY) { migrated++; continue }
			await sql.begin(tx => migrateOne(tx, row, targetSlug))
			migrated++
		} catch (error) {
			console.error(`  ✗ FAILED for ${row.kind} ${row.slug}:`, error)
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

async function fetchEntities(kind: EntityKind, table: 'star_systems' | 'stars' | 'planetary_bodies'): Promise<EntityRow[]> {
	const rows = await sql.unsafe(`
		SELECT id, slug, name,
			page_slug      AS "pageSlug",
			body,
			body_parsed_ast AS "bodyParsedAst",
			body_plain_text AS "bodyPlainText",
			body_size_bytes AS "bodySizeBytes",
			body_updated_at AS "bodyUpdatedAt"
		FROM ${table}
		WHERE char_length(body) > 0
		ORDER BY id
	`) as unknown as Array<Omit<EntityRow, 'kind' | 'table'>>
	return rows.map(r => ({ ...r, kind, table }))
}

type Tx = Parameters<Parameters<typeof sql.begin>[0]>[0]

async function migrateOne(tx: Tx, row: EntityRow, targetSlug: string): Promise<void> {
	const cr = await upsertKnowRecord(tx, targetSlug, row)

	const revs = await tx`
		SELECT title, snapshot, edit_summary AS "editSummary", user_id AS "userId", created_at AS "createdAt"
		FROM entity_revisions
		WHERE entity_type = ${row.kind} AND entity_id = ${row.id}
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

	// Repoint INBOUND content_links: (rodder, entity.slug) → (know, targetSlug)
	await tx`
		UPDATE content_links
		SET target_domain = 'know', target_slug = ${targetSlug}, target_id = NULL
		WHERE target_domain = 'rodder' AND LOWER(target_slug) = LOWER(${row.slug})
	`

	// Repoint OUTBOUND content_links: entity-source → know-source on the new cr
	await tx`
		UPDATE content_links
		SET source_kind = 'know', source_entity_id = ${cr.id}, source_id = ${cr.id}
		WHERE source_kind = ${row.kind} AND source_entity_id = ${row.id}
	`

	// Clear body fields, persist page_slug so the rodder data view can link back to Know.
	await tx.unsafe(
		`UPDATE ${row.table}
		 SET page_slug      = $1,
		     body           = '',
		     body_parsed_ast = NULL,
		     body_plain_text = '',
		     body_size_bytes = 0,
		     body_updated_at = NULL
		 WHERE id = $2`,
		[targetSlug, row.id],
	)

	// Drop the entity_revisions rows we just copied.
	await tx`DELETE FROM entity_revisions WHERE entity_type = ${row.kind} AND entity_id = ${row.id}`
}

async function upsertKnowRecord(tx: Tx, slug: string, body: EntityRow): Promise<{ id: number }> {
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
