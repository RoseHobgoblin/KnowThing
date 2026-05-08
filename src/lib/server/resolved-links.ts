import { db } from './db/index.js'
import { contentLinks, contentRecords, stars, planetaryBodies, starSystems } from './db/schema.js'
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

		// Structured-entity fallthrough: anything still unresolved that targets
		// 'celestial' may live in stars/planetary_bodies/star_systems now that
		// Phase 4 has dropped the celestial content_records shadow rows. Probe
		// those tables before giving up.
		const stillUnresolved = unresolvedEntries.filter(({ domain, slug }) =>
			!result.get(`${domain}:${slug}`)?.exists,
		)
		const celestialSlugs = [...new Set(
			stillUnresolved.filter(e => e.domain === 'celestial').map(e => e.slug),
		)]
		if (celestialSlugs.length > 0) {
			const slugList = sql.join(celestialSlugs.map(s => sql`${s}`), sql`, `)
			const matches = await db.execute(sql`
				SELECT slug FROM stars            WHERE LOWER(slug) IN (${slugList})
				UNION ALL
				SELECT slug FROM planetary_bodies WHERE LOWER(slug) IN (${slugList})
				UNION ALL
				SELECT slug FROM star_systems     WHERE LOWER(slug) IN (${slugList})
			`)
			const known = new Map<string, string>()
			for (const row of matches as unknown as Array<{ slug: string }>) {
				known.set(row.slug.toLowerCase(), row.slug)
			}
			for (const { slug } of stillUnresolved.filter(e => e.domain === 'celestial')) {
				const canonical = known.get(slug)
				if (canonical) {
					result.set(`celestial:${slug}`, {
						href: buildHref('celestial', canonical, null),
						exists: true,
					})
				}
			}
		}
	}

	return result
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
