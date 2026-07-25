// ============================================================================
// Entity article loader / saver
//
// Mirrors `article-loader.ts` + `content-records.ts` but reads/writes prose on
// a structured row's `body` field instead of a `content_records` row. Used by
// celestial routes after Phase 4 migration; reused by Wordbook (Phase 5),
// Calendar (Phase 6), Categories (Phase 7), CarveCraft (Phase 8).
// ============================================================================

import { eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	celestialBodies,
	languages, lexicon,
	calendars, categories, countries, worldMaps,
	contentLinks,
	entityRevisions,
} from '$lib/server/db/schema.js'
import { parseWikitext, extractPlainTextFromAst } from '$lib/parser/index.js'
import { getResolvedLinks, serializeResolvedLinks, type EntitySource } from '$lib/server/resolved-links.js'
import { updateContentEffects, type ContentEffectsDatabase } from '$lib/server/content-effects.js'
import type { WikiNode } from '$lib/parser/types.js'

export type EntityKind = EntitySource extends infer T ? T extends { kind: infer K } ? K : never : never

// All three celestial kinds live in the unified celestial_bodies table; the
// persisted kind string on entity_revisions/content_links matches the row's
// `kind` column ('planet' was rewritten to 'body' by migration 0043).
const ENTITY_TABLES = {
	star: celestialBodies,
	body: celestialBodies,
	system: celestialBodies,
	language: languages,
	lexicon,
	calendar: calendars,
	category: categories,
	country: countries,
	map: worldMaps,
} as const

function tableFor(kind: EntityKind) {
	if (kind === 'know') throw new Error('Use loadArticlePage for know-domain content')
	const t = ENTITY_TABLES[kind]
	if (!t) throw new Error(`No table mapping for entity kind: ${kind}`)
	return t
}

export interface EntityArticlePage {
	wikiContent: string
	ast: WikiNode | null
	/** Always null for entity-sourced articles; legacy callers branch on this. */
	contentRecordId: number | null
	entitySource: { kind: EntityKind, entityId: number }
	resolvedLinks: Record<string, { href: string, exists: boolean }>
}

/**
 * Load prose for a structured entity. The caller has already fetched the row
 * (so we accept `body` and `bodyParsedAst` directly rather than re-querying).
 */
export async function loadEntityBody(input: {
	kind: EntityKind
	entityId: number
	body: string
	bodyParsedAst: unknown
}): Promise<EntityArticlePage> {
	const { kind, entityId, body, bodyParsedAst } = input
	const ast = (bodyParsedAst as WikiNode | null)
		?? (body ? parseWikitext(body) : null)

	const links = await getResolvedLinks({ kind, entityId } as EntitySource)
	return {
		wikiContent: body,
		ast,
		contentRecordId: null,
		entitySource: { kind, entityId },
		resolvedLinks: serializeResolvedLinks(links),
	}
}

export interface SaveEntityBodyInput {
	kind: EntityKind
	entityId: number
	title: string
	content: string
	editSummary: string
	userId: number | null
}

export type SaveEntityBodyResult =
	| { ok: true }
	| { ok: false, status: number, error: string }

function byteLength(s: string): number {
	return new TextEncoder().encode(s).length
}

/**
 * Save prose to an entity's body, snapshot the prior state into
 * `entity_revisions`, and refresh derived `content_links` / categories /
 * media_usage tables. Mirrors `saveContentRecord` for entity sources.
 */
export async function saveEntityBody(
	database: ContentEffectsDatabase,
	input: SaveEntityBodyInput,
): Promise<SaveEntityBodyResult> {
	const table = tableFor(input.kind) as typeof celestialBodies

	// Read existing row for snapshot. Use a generic any-cast since each table
	// has its own schema but we only need the body fields here.
	const [existing] = await database
		.select({ body: table.body, bodyParsedAst: table.bodyParsedAst, bodyPlainText: table.bodyPlainText, bodySizeBytes: table.bodySizeBytes })
		.from(table)
		.where(eq(table.id, input.entityId))

	if (!existing) return { ok: false, status: 404, error: `${input.kind} ${input.entityId} not found` }

	// Snapshot prior body into entity_revisions BEFORE overwriting. Live
	// writes keep the legacy tuple; spine_consolidate_revisions() maps the
	// delta onto (entity_id, facet_key) at the writer flip.
	if (existing.body) {
		await database.insert(entityRevisions).values({
			legacyEntityType: input.kind,
			legacyEntityId: input.entityId,
			title: input.title,
			snapshot: { title: input.title, content: existing.body, sizeBytes: existing.bodySizeBytes ?? 0 },
			editSummary: input.editSummary,
			userId: input.userId,
		})
	}

	// Refresh derived tables (links/categories/media). updateContentEffects
	// reparses and returns plainText + ast we can reuse below.
	const sourceDomain = SOURCE_DOMAIN_FOR_KIND[input.kind] ?? 'know'
	const { plainText, ast } = await updateContentEffects(
		database,
		/* legacy contentRecordId, unused for entity sources */ 0,
		input.content,
		sourceDomain,
		{ kind: input.kind, entityId: input.entityId },
	)

	const sizeBytes = byteLength(input.content)

	await database
		.update(table)
		.set({
			body: input.content,
			bodyParsedAst: ast,
			bodyPlainText: plainText,
			bodySizeBytes: sizeBytes,
			bodyUpdatedAt: new Date(),
		} as never)
		.where(eq(table.id, input.entityId))

	return { ok: true }
}

/**
 * Map an entity kind to the same-domain bucket used for resolving same-domain
 * `[[Foo]]` internal links inside that entity's prose. (Same as the wiki
 * articles' `domain` column.)
 */
const SOURCE_DOMAIN_FOR_KIND: Partial<Record<EntityKind, string>> = {
	star: 'celestial',
	body: 'celestial',
	system: 'celestial',
	language: 'wordbook',
	lexicon: 'wordbook',
	calendar: 'calendar',
	category: 'know',
	country: 'know',
	map: 'know',
}
