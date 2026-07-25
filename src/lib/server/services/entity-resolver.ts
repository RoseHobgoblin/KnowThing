// ============================================================================
// Entity route resolution — the reader side of the spine (step 6).
//
// Every address is one route row pointing at the FINAL entity: canonical →
// 200, noncanonical → 301, archived canonical → 200 with a banner, merged
// losers never resolve (their routes were repointed at the survivor when
// they merged). Readers resolve THROUGH ROUTES, never by comparing
// canonical slug strings — or links written under former names never heal.
//
// Non-entity namespaces (Template/File/Image/Special/CarveCraft) are the
// caller's business and stay in front of these lookups, exactly as the
// registry does today.
// ============================================================================

import { eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	calendars,
	categories,
	celestialBodies,
	contentRecords,
	countries,
	entityRoutes,
	languages,
	lexicon,
	worldMaps,
} from '$lib/server/db/schema.js'
import type { EntitySpineDatabase } from '$lib/server/services/entity-spine.js'
import { mintEntitySlug, type RouteNamespace } from '$lib/utils/slugify.js'

export interface ResolvedAddress {
	entityId: number
	displayName: string
	/** 'active' | 'archived' — merged entities own no routes by invariant. */
	status: string
	/** The route row the segment matched (possibly a retired alias). */
	matched: { slug: string, isCanonical: boolean }
	/** The entity's canonical address. */
	canonical: { namespace: string, slug: string, scopeEntityId: number | null }
}

/**
 * Resolve one address through the routes table, case-insensitively. Returns
 * null when no route row claims the address — the caller decides between a
 * legacy-table fallback (transition) and a red link.
 */
export async function resolveAddress(
	dbx: EntitySpineDatabase,
	namespace: RouteNamespace,
	slug: string,
	scopeEntityId: number | null = null,
): Promise<ResolvedAddress | null> {
	const rows = await dbx.execute(sql`
		SELECT
			r.entity_id AS "entityId",
			e.display_name AS "displayName",
			e.status,
			r.slug AS "matchedSlug",
			r.is_canonical AS "matchedCanonical",
			c.namespace AS "canonicalNamespace",
			c.slug AS "canonicalSlug",
			c.scope_entity_id AS "canonicalScope"
		FROM entity_routes r
		JOIN entities e ON e.id = r.entity_id
		JOIN entity_routes c ON c.entity_id = e.id AND c.is_canonical
		WHERE r.namespace = ${namespace}
			AND r.scope_entity_id IS NOT DISTINCT FROM ${scopeEntityId}
			AND LOWER(r.slug) = LOWER(${slug.normalize('NFC')})
		LIMIT 1
	`) as unknown as Array<{
		entityId: number
		displayName: string
		status: string
		matchedSlug: string
		matchedCanonical: boolean
		canonicalNamespace: string
		canonicalSlug: string
		canonicalScope: number | null
	}>
	const row = rows[0]
	if (!row) return null

	return {
		entityId: row.entityId,
		displayName: row.displayName,
		status: row.status,
		matched: { slug: row.matchedSlug, isCanonical: row.matchedCanonical },
		canonical: {
			namespace: row.canonicalNamespace,
			slug: row.canonicalSlug,
			scopeEntityId: row.canonicalScope,
		},
	}
}

// ----------------------------------------------------------------------------
// Facet lookups — map a resolved entity back to the typed row a reader
// actually renders. A facet-table row IS the attachment.
// ----------------------------------------------------------------------------

export async function getArticleFacet(dbx: EntitySpineDatabase, entityId: number) {
	const [record] = await dbx
		.select()
		.from(contentRecords)
		.where(eq(contentRecords.entityId, entityId))
		.limit(1)
	return record ?? null
}

export async function getLanguageFacet(dbx: EntitySpineDatabase, entityId: number) {
	const [row] = await dbx.select().from(languages).where(eq(languages.entityId, entityId)).limit(1)
	return row ?? null
}

export async function getLexiconFacet(dbx: EntitySpineDatabase, entityId: number) {
	const [row] = await dbx.select().from(lexicon).where(eq(lexicon.entityId, entityId)).limit(1)
	return row ?? null
}

/**
 * The legacy page URL for an entity that has a typed facet but no article —
 * the know reader 301s there instead of rendering an empty page. Facets
 * without a standalone page today (country, category) return null.
 */
export async function legacyFacetHref(dbx: EntitySpineDatabase, entityId: number): Promise<string | null> {
	const [celestial] = await dbx
		.select({ slug: celestialBodies.slug })
		.from(celestialBodies)
		.where(eq(celestialBodies.entityId, entityId))
		.limit(1)
	if (celestial) return `/Celestial:${celestial.slug}`

	const language = await getLanguageFacet(dbx, entityId)
	if (language) return `/Wordbook/${language.slug}`

	const lexeme = await getLexiconFacet(dbx, entityId)
	if (lexeme) {
		const [lang] = await dbx
			.select({ slug: languages.slug })
			.from(languages)
			.where(eq(languages.id, lexeme.languageId))
			.limit(1)
		if (lang) return `/Wordbook/${lang.slug}/${encodeURIComponent(lexeme.word)}`
	}

	const [calendar] = await dbx
		.select({ slug: calendars.slug })
		.from(calendars)
		.where(eq(calendars.entityId, entityId))
		.limit(1)
	if (calendar) return `/Calendar:${calendar.slug}`

	const [map] = await dbx
		.select({ slug: worldMaps.slug })
		.from(worldMaps)
		.where(eq(worldMaps.entityId, entityId))
		.limit(1)
	if (map) return `/worldmap/${map.slug}`

	return null
}

// ----------------------------------------------------------------------------
// Know pages
// ----------------------------------------------------------------------------

export type KnowResolution =
	| { kind: 'redirect', href: string }
	| { kind: 'article', record: typeof contentRecords.$inferSelect, entityId: number, archived: boolean }
	/** No route claims the address — the caller falls back to legacy lookup. */
	| null

/**
 * Resolve a /know/<slug> read through routes. Retired addresses 301 to the
 * canonical; canonical addresses render the entity's article facet (with an
 * archived banner when the entity is archived); article-less entities 301
 * to their typed page.
 */
export async function resolveKnowPage(dbx: EntitySpineDatabase, slug: string): Promise<KnowResolution> {
	const address = await resolveAddress(dbx, 'know', slug)
	if (!address) return null

	const record = await getArticleFacet(dbx, address.entityId)

	// Retired alias, or canonical entered in a different spelling: 301 to
	// the canonical address — when it renders here. Article-less entities
	// 301 straight to their typed page instead.
	const enteredCanonically = address.matched.isCanonical
		&& slug === address.canonical.slug
		&& address.canonical.namespace === 'know'

	if (!record) {
		const typed = await legacyFacetHref(dbx, address.entityId)
		return typed ? { kind: 'redirect', href: typed } : null
	}

	if (!enteredCanonically) {
		if (address.canonical.namespace === 'know') {
			return { kind: 'redirect', href: `/know/${address.canonical.slug}` }
		}
		const typed = await legacyFacetHref(dbx, address.entityId)
		if (typed) return { kind: 'redirect', href: typed }
	}

	return {
		kind: 'article',
		record,
		entityId: address.entityId,
		archived: address.status === 'archived',
	}
}

// ----------------------------------------------------------------------------
// The Wordbook resolution algorithm (/Wordbook/<lang>/<word>) — verbatim
// from the design:
//   1. Resolve <lang> through ALL language routes, canonical or not.
//   2. Require the resolved entity to have the language facet.
//   3. Resolve (wordbook, scope = resolved language, <word>).
//   4. Build the final URL from the language's canonical route + the
//      lexeme's canonical scoped route.
//   5. 301 if either entered segment was noncanonical.
// Red-link states are all representable: word missing under a live
// language; language written under a former slug; neither exists.
// ----------------------------------------------------------------------------

export type WordbookResolution =
	| { state: 'language-missing' }
	| {
		state: 'word-missing'
		language: typeof languages.$inferSelect
		languageEntityId: number
		/** Canonical language segment — red links preserve the resolved scope. */
		canonicalLanguageSlug: string
		archived: boolean
	}
	| {
		state: 'resolved'
		language: typeof languages.$inferSelect
		languageEntityId: number
		lexeme: typeof lexicon.$inferSelect
		canonicalHref: string
		/** True when either entered segment was noncanonical (→ 301). */
		needsRedirect: boolean
		archived: boolean
	}

export async function resolveWordbook(
	dbx: EntitySpineDatabase,
	langSegment: string,
	wordSegment: string,
): Promise<WordbookResolution> {
	// 1. All language routes, canonical or not.
	const langAddress = await resolveAddress(dbx, 'know', langSegment)
	if (!langAddress) return { state: 'language-missing' }

	// 2. The language facet is required — a same-named article is not a scope.
	const language = await getLanguageFacet(dbx, langAddress.entityId)
	if (!language) return { state: 'language-missing' }

	// 3. Resolve the word inside the resolved language's scope. Legacy links
	// carry the word text itself ("op de boek"); route slugs are minted
	// ("op-de-boek") — retry through the minting rules so old links heal.
	let wordAddress = await resolveAddress(dbx, 'wordbook', wordSegment, langAddress.entityId)
	if (!wordAddress) {
		const minted = mintEntitySlug('wordbook', wordSegment)
		if (minted && minted.toLowerCase() !== wordSegment.toLowerCase()) {
			wordAddress = await resolveAddress(dbx, 'wordbook', minted, langAddress.entityId)
		}
	}
	const lexeme = wordAddress ? await getLexiconFacet(dbx, wordAddress.entityId) : null
	if (!wordAddress || !lexeme) {
		return {
			state: 'word-missing',
			language,
			languageEntityId: langAddress.entityId,
			canonicalLanguageSlug: langAddress.canonical.slug,
			archived: langAddress.status === 'archived',
		}
	}

	// 4. Final URL from the two canonical routes; 5. 301 when the entered
	// address differs from it in either segment.
	const canonicalHref = `/Wordbook/${langAddress.canonical.slug}/${encodeURIComponent(wordAddress.canonical.slug)}`
	const needsRedirect = langSegment !== langAddress.canonical.slug
		|| wordSegment !== wordAddress.canonical.slug

	return {
		state: 'resolved',
		language,
		languageEntityId: langAddress.entityId,
		lexeme,
		canonicalHref,
		needsRedirect,
		archived: wordAddress.status === 'archived' || langAddress.status === 'archived',
	}
}

/** Language page resolution (/Wordbook/<lang>) — steps 1–2 + the 301 rule. */
export async function resolveWordbookLanguage(
	dbx: EntitySpineDatabase,
	langSegment: string,
): Promise<{ language: typeof languages.$inferSelect, canonicalSlug: string, needsRedirect: boolean, archived: boolean } | null> {
	const address = await resolveAddress(dbx, 'know', langSegment)
	if (!address) return null
	const language = await getLanguageFacet(dbx, address.entityId)
	if (!language) return null
	return {
		language,
		canonicalSlug: address.canonical.slug,
		needsRedirect: langSegment !== address.canonical.slug,
		archived: address.status === 'archived',
	}
}

// ----------------------------------------------------------------------------
// Typed-namespace resolution for the link resolver: route → entity → typed
// row, so `Celestial:the-sun`, `Celestial:Sun`, and any retired alias all
// heal to the same page. Returns null when routes know nothing (legacy
// fallback) or the entity lacks the facet.
// ----------------------------------------------------------------------------

export interface TypedFacetTarget {
	entityId: number
	typedId: number
	slug: string
	title: string
	kind?: string
}

const TYPED_FACET_TABLES = {
	celestial: celestialBodies,
	calendar: calendars,
	country: countries,
	map: worldMaps,
	category: categories,
} as const

// ----------------------------------------------------------------------------
// Live bindings for route handlers — the custom lint rule keeps db imports
// out of routes, so loaders call these; tests inject their own executor
// into the parameterized functions above.
// ----------------------------------------------------------------------------

export function resolveKnowPageRead(slug: string): Promise<KnowResolution> {
	return resolveKnowPage(db, slug)
}

export function resolveWordbookRead(langSegment: string, wordSegment: string): Promise<WordbookResolution> {
	return resolveWordbook(db, langSegment, wordSegment)
}

export function resolveWordbookLanguageRead(langSegment: string) {
	return resolveWordbookLanguage(db, langSegment)
}

export async function resolveTypedFacet(
	dbx: EntitySpineDatabase,
	facet: keyof typeof TYPED_FACET_TABLES,
	identifier: string,
): Promise<TypedFacetTarget | null> {
	const namespace: RouteNamespace = facet === 'category' ? 'category' : 'know'
	const address = await resolveAddress(dbx, namespace, identifier)
	if (!address) return null

	const table = TYPED_FACET_TABLES[facet]
	const rows = await dbx
		.select()
		.from(table)
		.where(eq(table.entityId, address.entityId))
		.limit(1) as Array<Record<string, unknown>>
	const row = rows[0]
	if (!row) return null

	const title = typeof row.name === 'string'
		? row.name
		: (typeof row.title === 'string' ? row.title : address.displayName)
	return {
		entityId: address.entityId,
		typedId: row.id as number,
		slug: row.slug as string,
		title,
		kind: typeof row.kind === 'string' ? row.kind : undefined,
	}
}
