import { db } from './db/index.js'
import { calendars, contentLinks, contentRecords, languages, lexicon, planetaryBodies, starSystems, stars } from './db/schema.js'
import { eq, sql, and, inArray } from 'drizzle-orm'

export interface ResolvedLink {
	href: string
	exists: boolean
}

/** All content domains — unresolved links in one domain fall through to the others */
const ALL_DOMAINS = ['know', 'celestial', 'calendar']

export type EntitySource =
	| { kind: 'know', contentRecordId: number }
	| { kind: 'star' | 'planet' | 'system' | 'language' | 'lexicon' | 'calendar' | 'category' | 'country' | 'map', entityId: number }

/**
 * For a given content record OR structured-entity source, fetch its outbound
 * links from `content_links` and resolve each to an href + existence flag.
 *
 * For unresolved links in any domain, falls through to check all other domains.
 *
 * Returns a Map keyed by "domain:slug" (lowercase, e.g. "know:onchera").
 *
 * Accepts either a legacy numeric `contentRecordId` (= source_kind 'know') or
 * a `{ kind, ... }` discriminated union for entity-sourced links.
 */
export async function getResolvedLinks(source: number | EntitySource): Promise<Map<string, ResolvedLink>> {
	const src: EntitySource = typeof source === 'number'
		? { kind: 'know', contentRecordId: source }
		: source

	const rows = await db
		.select({
			targetDomain: contentLinks.targetDomain,
			targetSlug: contentLinks.targetSlug,
			resolvedId: contentRecords.id,
			targetParentPath: contentRecords.parentPath,
			resolvedSlug: contentRecords.slug,
		})
		.from(contentLinks)
		.leftJoin(contentRecords, and(
			eq(contentRecords.domain, contentLinks.targetDomain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${contentLinks.targetSlug})`,
		))
		.where(and(
			eq(contentLinks.sourceKind, src.kind),
			eq(contentLinks.sourceEntityId, src.kind === 'know' ? src.contentRecordId : src.entityId),
		))

	const result = new Map<string, ResolvedLink>()

	// Collect unresolved slugs (with their source domain) for cross-domain fallthrough
	const unresolvedEntries: { domain: string, slug: string }[] = []

	for (const row of rows) {
		const key = `${row.targetDomain}:${row.targetSlug.toLowerCase()}`
		const exists = row.resolvedId !== null
		// Use the actual record slug for the URL (handles moves), fall back to targetSlug for red links
		const hrefSlug = row.resolvedSlug ?? row.targetSlug
		const href = buildHref(row.targetDomain, hrefSlug, row.targetParentPath)
		result.set(key, { href, exists })

		if (!exists) {
			unresolvedEntries.push({ domain: row.targetDomain, slug: row.targetSlug.toLowerCase() })
		}
	}

	// Cross-domain fallthrough: for any unresolved link, check all OTHER domains.
	// Updates the original key in-place so the client gets a single authoritative answer.
	if (unresolvedEntries.length > 0) {
		const uniqueSlugs = [...new Set(unresolvedEntries.map(entry => entry.slug))]
		const crossDomainMatches = await db
			.select({
				domain: contentRecords.domain,
				slug: contentRecords.slug,
				parentPath: contentRecords.parentPath,
			})
			.from(contentRecords)
			.where(and(
				inArray(contentRecords.domain, ALL_DOMAINS),
				sql`LOWER(${contentRecords.slug}) IN (${sql.join(uniqueSlugs.map(s => sql`${s}`), sql`, `)})`,
			))

		// Index matches by lowercase slug → first match wins
		const slugToMatch = new Map<string, typeof crossDomainMatches[number]>()
		for (const match of crossDomainMatches) {
			const ls = match.slug.toLowerCase()
			if (!slugToMatch.has(ls)) slugToMatch.set(ls, match)
		}

		for (const { domain, slug } of unresolvedEntries) {
			const match = slugToMatch.get(slug)
			if (match && match.domain !== domain) {
				result.set(`${domain}:${slug}`, {
					href: buildHref(match.domain, match.slug, match.parentPath),
					exists: true,
				})
			}
		}

		// Structured-entity fallthrough: any link still unresolved may target a
		// row in a structured table (post-Phase-4+ the shadow content_records
		// for these domains are gone). Probe each domain's tables.
		const stillUnresolved = unresolvedEntries.filter(({ domain, slug }) =>
			!result.get(`${domain}:${slug}`)?.exists,
		)
		await resolveCelestialFallthrough(stillUnresolved, result)
		await resolveCalendarFallthrough(stillUnresolved, result)
		await resolveWordbookFallthrough(stillUnresolved, result)
	}

	return result
}

async function resolveCelestialFallthrough(
	unresolved: { domain: string, slug: string }[],
	result: Map<string, ResolvedLink>,
): Promise<void> {
	const slugs = [...new Set(unresolved.filter(e => e.domain === 'celestial').map(e => e.slug))]
	if (slugs.length === 0) return
	const matches = await db.execute(sql`
		SELECT slug FROM ${stars}            WHERE LOWER(slug) IN ${sql`(${sql.join(slugs.map(s => sql`${s}`), sql`, `)})`}
		UNION ALL
		SELECT slug FROM ${planetaryBodies} WHERE LOWER(slug) IN ${sql`(${sql.join(slugs.map(s => sql`${s}`), sql`, `)})`}
		UNION ALL
		SELECT slug FROM ${starSystems}     WHERE LOWER(slug) IN ${sql`(${sql.join(slugs.map(s => sql`${s}`), sql`, `)})`}
	`)
	const known = new Map<string, string>()
	for (const row of matches as unknown as Array<{ slug: string }>) {
		known.set(row.slug.toLowerCase(), row.slug)
	}
	for (const { slug } of unresolved.filter(e => e.domain === 'celestial')) {
		const canonical = known.get(slug)
		if (canonical) result.set(`celestial:${slug}`, { href: buildHref('celestial', canonical, null), exists: true })
	}
}

async function resolveCalendarFallthrough(
	unresolved: { domain: string, slug: string }[],
	result: Map<string, ResolvedLink>,
): Promise<void> {
	const slugs = [...new Set(unresolved.filter(e => e.domain === 'calendar').map(e => e.slug))]
	if (slugs.length === 0) return
	const matches = await db
		.select({ slug: calendars.slug })
		.from(calendars)
		.where(inArray(sql`LOWER(${calendars.slug})`, slugs))
	const known = new Map<string, string>()
	for (const row of matches) known.set(row.slug.toLowerCase(), row.slug)
	for (const { slug } of unresolved.filter(e => e.domain === 'calendar')) {
		const canonical = known.get(slug)
		if (canonical) result.set(`calendar:${slug}`, { href: buildHref('calendar', canonical, null), exists: true })
	}
}

/**
 * Wordbook targets are stored in `content_links` either as `<lang>` (a
 * language link) or `<lang>/<word>` (a lexicon link, slash form).
 */
async function resolveWordbookFallthrough(
	unresolved: { domain: string, slug: string }[],
	result: Map<string, ResolvedLink>,
): Promise<void> {
	const wbEntries = unresolved.filter(e => e.domain === 'wordbook')
	if (wbEntries.length === 0) return

	const langEntries = wbEntries.filter(e => !e.slug.includes('/'))
	const wordEntries = wbEntries.filter(e => e.slug.includes('/'))

	if (langEntries.length > 0) {
		const slugs = [...new Set(langEntries.map(e => e.slug))]
		const langMatches = await db
			.select({ slug: languages.slug })
			.from(languages)
			.where(inArray(sql`LOWER(${languages.slug})`, slugs))
		const known = new Map<string, string>()
		for (const r of langMatches) known.set(r.slug.toLowerCase(), r.slug)
		for (const { slug } of langEntries) {
			const canonical = known.get(slug)
			if (canonical) result.set(`wordbook:${slug}`, { href: `/wordbook/${canonical}`, exists: true })
		}
	}

	if (wordEntries.length > 0) {
		// Each entry slug is `<lang>/<word>`. Resolve in batches by language.
		const byLang = new Map<string, string[]>()
		for (const { slug } of wordEntries) {
			const idx = slug.indexOf('/')
			const langSlug = slug.slice(0, idx)
			const word = slug.slice(idx + 1)
			if (!byLang.has(langSlug)) byLang.set(langSlug, [])
			byLang.get(langSlug)!.push(word)
		}
		const langSlugs = [...byLang.keys()]
		const langs = await db
			.select({ id: languages.id, slug: languages.slug })
			.from(languages)
			.where(inArray(sql`LOWER(${languages.slug})`, langSlugs))
		const langBySlug = new Map(langs.map(l => [l.slug.toLowerCase(), l]))

		for (const [langSlug, words] of byLang) {
			const lang = langBySlug.get(langSlug)
			if (!lang) continue
			const found = await db
				.select({ word: lexicon.word })
				.from(lexicon)
				.where(and(eq(lexicon.languageId, lang.id), inArray(sql`LOWER(${lexicon.word})`, words)))
			const knownWords = new Map(found.map(r => [r.word.toLowerCase(), r.word]))
			for (const word of words) {
				const canonical = knownWords.get(word)
				if (canonical) {
					result.set(`wordbook:${langSlug}/${word}`, {
						href: `/wordbook/${lang.slug}/${encodeURIComponent(canonical)}`,
						exists: true,
					})
				}
			}
		}
	}
}

function buildHref(domain: string, slug: string, parentPath: string | null | undefined): string {
	if (domain === 'know') {
		return `/know/${slug}`
	}
	if (parentPath) {
		return `/${domain}/${parentPath}/${slug}`
	}
	return `/${domain}/${slug}`
}

/**
 * Serialize the resolved links map for passing through SvelteKit load data.
 */
export function serializeResolvedLinks(links: Map<string, ResolvedLink>): Record<string, ResolvedLink> {
	return Object.fromEntries(links)
}
