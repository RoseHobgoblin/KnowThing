import { db } from './db/index.js'
import { contentLinks, contentRecords } from './db/schema.js'
import { eq, sql, and, inArray } from 'drizzle-orm'

export interface ResolvedLink {
	href: string
	exists: boolean
}

/** All content domains — unresolved links in one domain fall through to the others */
const ALL_DOMAINS = ['know', 'celestial', 'calendar']

/**
 * For a given content record, fetch its outbound links from the content_links
 * table and resolve each to an href + existence flag by joining content_records.
 *
 * For unresolved links in any domain, falls through to check all other domains.
 *
 * Returns a Map keyed by "domain:slug" (lowercase, e.g. "know:onchera").
 */
export async function getResolvedLinks(sourceId: number): Promise<Map<string, ResolvedLink>> {
	// Join on (domain, slug) instead of targetId so existence is always checked
	// live — stale targetId values can't cause phantom red links.
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
		.where(eq(contentLinks.sourceId, sourceId))

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
