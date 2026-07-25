// ============================================================================
// Namespace resolver
//
// Resolves a `Namespace:Identifier` reference (or a Wordbook slash-path) to a
// canonical href + existence flag, by querying the right structured table.
// One choke point used by link rendering, embeds, and the new routing layer.
// ============================================================================

import { db } from './db/index.js'
import {
	celestialBodies,
	languages, lexicon,
	calendars, countries, worldMaps,
	categories,
	contentRecords,
} from './db/schema.js'
import { eq, sql, and } from 'drizzle-orm'
import type { NamespaceKey } from '../namespaces/registry.js'
import type { WordbookPath } from '../sections/wordbook-path.js'
import { buildWordbookHref } from '../sections/wordbook-path.js'
import {
	getLanguageFacet,
	getLexiconFacet,
	resolveAddress,
	resolveTypedFacet,
} from './services/entity-resolver.js'

export type EntityKind =
	| 'celestial-system'
	| 'celestial-star'
	| 'celestial-body'
	| 'wordbook-language'
	| 'wordbook-word'
	| 'calendar'
	| 'category'
	| 'country'
	| 'map'
	| 'know'

export interface ResolvedTarget {
	kind: EntityKind | null
	href: string
	title: string
	exists: boolean
	/** Numeric id of the resolved row, when exists. Used by content_links etc. */
	entityId?: number
}

/**
 * Build a canonical URL for a resolved target. Phase 3 flips the URL builder
 * in resolved-links.ts to call into here; until then, link rendering still
 * emits the legacy /domain/slug URLs, and this function is consumed only by
 * code paths that explicitly want the new shape.
 */
export function buildNamespaceHref(ns: NamespaceKey, identifier: string): string {
	return `/${ns}:${encodeURIComponent(identifier).replaceAll('%20', '_')}`
}

// Per-request cache to coalesce repeated lookups within a single page load.
// Callers that don't share a request can pass a fresh Map.
export type ResolverCache = Map<string, ResolvedTarget>

function cacheKey(kind: string, identifier: string): string {
	return `${kind}:${identifier.toLowerCase()}`
}

/**
 * Resolve a `Namespace:Identifier` reference. Identifier preserves case;
 * matching against the DB is case-insensitive on slug/name.
 */
export async function resolveNamespaceTarget(
	ns: NamespaceKey,
	identifier: string,
	cache: ResolverCache = new Map(),
): Promise<ResolvedTarget> {
	const cached = cache.get(cacheKey(ns, identifier))
	if (cached) return cached

	const result = await dispatchResolve(ns, identifier)
	cache.set(cacheKey(ns, identifier), result)
	return result
}

async function dispatchResolve(ns: NamespaceKey, identifier: string): Promise<ResolvedTarget> {
	// Reader flip: entity namespaces resolve THROUGH ROUTES first, so wiki
	// canonicals, legacy hyphen slugs, and every retired alias all heal to
	// the same page. The legacy table lookups stay as the fallback for
	// spine-less rows. Non-entity namespaces are resolved before any routes
	// lookup, exactly as before.
	switch (ns) {
		case 'Celestial': return await resolveCelestialViaRoutes(identifier) ?? resolveCelestial(identifier)
		case 'Calendar': return await resolveSimpleViaRoutes('calendar', 'Calendar', identifier) ?? resolveSimple('calendar', calendars, identifier)
		case 'Category': return await resolveSimpleViaRoutes('category', 'Category', identifier) ?? resolveSimple('category', categories, identifier)
		case 'Country': return await resolveSimpleViaRoutes('country', 'Country', identifier) ?? resolveSimple('country', countries, identifier)
		case 'Map': return await resolveSimpleViaRoutes('map', 'Map', identifier) ?? resolveSimple('map', worldMaps, identifier)
		case 'CarveCraft': return missing(ns, identifier) // Phase 8 wires this up
		case 'Template': return resolveTemplate(identifier)
		case 'File':
		case 'Image': return missing(ns, identifier) // handled by image nodes, not here
		case 'Special': return missing(ns, identifier)
	}
}

async function resolveCelestialViaRoutes(identifier: string): Promise<ResolvedTarget | null> {
	const target = await resolveTypedFacet(db, 'celestial', identifier)
	if (!target) return null
	let kind: EntityKind = 'celestial-body'
	if (target.kind === 'system') kind = 'celestial-system'
	else if (target.kind === 'star') kind = 'celestial-star'
	return {
		kind,
		href: buildNamespaceHref('Celestial', target.slug),
		title: target.title,
		exists: true,
		entityId: target.typedId,
	}
}

async function resolveSimpleViaRoutes(
	facet: 'calendar' | 'category' | 'country' | 'map',
	ns: NamespaceKey,
	identifier: string,
): Promise<ResolvedTarget | null> {
	const target = await resolveTypedFacet(db, facet, identifier)
	if (!target) return null
	return {
		kind: facet,
		href: buildNamespaceHref(ns, target.slug),
		title: target.title,
		exists: true,
		entityId: target.typedId,
	}
}

function missing(ns: NamespaceKey, identifier: string): ResolvedTarget {
	return {
		kind: null,
		href: buildNamespaceHref(ns, identifier),
		title: identifier,
		exists: false,
	}
}

async function resolveCelestial(identifier: string): Promise<ResolvedTarget> {
	const lower = identifier.toLowerCase()
	const [entity] = await db
		.select({ id: celestialBodies.id, slug: celestialBodies.slug, name: celestialBodies.name, kind: celestialBodies.kind })
		.from(celestialBodies)
		.where(sql`LOWER(${celestialBodies.slug}) = ${lower}`)
		.limit(1)
	if (!entity) return missing('Celestial', identifier)
	const kind: EntityKind =
		entity.kind === 'system'
			? 'celestial-system'
			: (entity.kind === 'star'
				? 'celestial-star'
				: 'celestial-body')
	return {
		kind,
		href: buildNamespaceHref('Celestial', entity.slug),
		title: entity.name,
		exists: true,
		entityId: entity.id,
	}
}

async function resolveSimple(
	kind: 'calendar' | 'category' | 'country' | 'map',
	table: typeof calendars | typeof categories | typeof countries | typeof worldMaps,
	identifier: string,
): Promise<ResolvedTarget> {
	const lower = identifier.toLowerCase()
	const rows = await db
		.select()
		.from(table)
		.where(sql`LOWER(${table.slug}) = ${lower}`)
		.limit(1)
	const row = rows[0]
	const ns: NamespaceKey =
		kind === 'calendar'
			? 'Calendar'
			: kind === 'category'
				? 'Category'
				: kind === 'country'
					? 'Country'
					: 'Map'
	if (!row) return missing(ns, identifier)
	const title =
		'name' in row && typeof row.name === 'string'
			? row.name
			: ('title' in row && typeof row.title === 'string'
				? row.title
				: identifier)
	return {
		kind,
		href: buildNamespaceHref(ns, row.slug),
		title,
		exists: true,
		entityId: row.id,
	}
}

async function resolveTemplate(identifier: string): Promise<ResolvedTarget> {
	// Templates aren't first-class pages today; render a Know-domain redlink
	// so editors can create them like any other article.
	const [row] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, 'know'),
			sql`LOWER(${contentRecords.slug}) = ${`template:${identifier.toLowerCase()}`}`,
		))
		.limit(1)
	return {
		kind: row ? 'know' : null,
		href: `/know/Template:${encodeURIComponent(identifier)}`,
		title: `Template:${identifier}`,
		exists: !!row,
		entityId: row?.id,
	}
}

/**
 * Route-resolved Wordbook target: the language entity is known; find the
 * word by scoped route first, then by headword text inside the resolved
 * language. Results keep the legacy shape — hrefs carry the stored language
 * slug + word text, and 301 to the canonical address on click.
 */
async function resolveRoutedWordbookTarget(
	path: WordbookPath,
	languageEntityId: number,
	langRow: { id: number, slug: string, name: string },
): Promise<ResolvedTarget> {
	if (!path.word) {
		return {
			kind: 'wordbook-language',
			href: buildWordbookHref({ language: langRow.slug }),
			title: langRow.name,
			exists: true,
			entityId: langRow.id,
		}
	}

	const wordAddress = await resolveAddress(db, 'wordbook', path.word, languageEntityId)
	const lexRow = wordAddress ? await getLexiconFacet(db, wordAddress.entityId) : null
	if (lexRow) {
		return {
			kind: 'wordbook-word',
			href: buildWordbookHref({ language: langRow.slug, word: lexRow.word }),
			title: `${lexRow.word} (${langRow.name})`,
			exists: true,
			entityId: lexRow.id,
		}
	}

	// Legacy word lookup inside the route-resolved language, then red link —
	// the unresolved word keeps the resolved language scope.
	const wordLower = path.word.toLowerCase()
	const [entry] = await db
		.select({ id: lexicon.id, word: lexicon.word })
		.from(lexicon)
		.where(and(
			eq(lexicon.languageId, langRow.id),
			sql`LOWER(${lexicon.word}) = ${wordLower}`,
		))
		.limit(1)
	if (entry) {
		return {
			kind: 'wordbook-word',
			href: buildWordbookHref({ language: langRow.slug, word: entry.word }),
			title: `${entry.word} (${langRow.name})`,
			exists: true,
			entityId: entry.id,
		}
	}
	return {
		kind: null,
		href: buildWordbookHref({ language: langRow.slug, word: path.word }),
		title: `${path.word} (${langRow.name})`,
		exists: false,
	}
}

/**
 * Resolve a Wordbook slash-path target (`Lang` or `Lang/Word`).
 */
export async function resolveWordbookPath(
	path: WordbookPath,
	cache: ResolverCache = new Map(),
): Promise<ResolvedTarget> {
	const ckey = cacheKey('wordbook', path.word ? `${path.language}/${path.word}` : path.language)
	const cached = cache.get(ckey)
	if (cached) return cached

	// Reader flip: the language segment resolves through ALL language routes
	// (canonical or not), so mentions written under former language names
	// heal — never by comparing canonical slug strings. Legacy slug lookup
	// remains the fallback for spine-less rows.
	const routedLang = await resolveAddress(db, 'know', path.language)
	if (routedLang) {
		const langRow = await getLanguageFacet(db, routedLang.entityId)
		if (langRow) {
			const result = await resolveRoutedWordbookTarget(path, routedLang.entityId, langRow)
			cache.set(ckey, result)
			return result
		}
	}

	const langLower = path.language.toLowerCase()
	const [lang] = await db
		.select({ id: languages.id, slug: languages.slug, name: languages.name })
		.from(languages)
		.where(sql`LOWER(${languages.slug}) = ${langLower}`)
		.limit(1)

	if (!lang) {
		const result: ResolvedTarget = {
			kind: null,
			href: buildWordbookHref(path),
			title: path.word ? `${path.word} (${path.language})` : path.language,
			exists: false,
		}
		cache.set(ckey, result)
		return result
	}

	if (!path.word) {
		const result: ResolvedTarget = {
			kind: 'wordbook-language',
			href: buildWordbookHref({ language: lang.slug }),
			title: lang.name,
			exists: true,
			entityId: lang.id,
		}
		cache.set(ckey, result)
		return result
	}

	const wordLower = path.word.toLowerCase()
	const [entry] = await db
		.select({ id: lexicon.id, word: lexicon.word })
		.from(lexicon)
		.where(and(
			eq(lexicon.languageId, lang.id),
			sql`LOWER(${lexicon.word}) = ${wordLower}`,
		))
		.limit(1)

	const result: ResolvedTarget = entry
		? {
			kind: 'wordbook-word',
			href: buildWordbookHref({ language: lang.slug, word: entry.word }),
			title: `${entry.word} (${lang.name})`,
			exists: true,
			entityId: entry.id,
		}
		: {
			kind: null,
			href: buildWordbookHref({ language: lang.slug, word: path.word }),
			title: `${path.word} (${lang.name})`,
			exists: false,
		}
	cache.set(ckey, result)
	return result
}
