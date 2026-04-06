import { db } from './db/index.js'
import { contentLinks, contentRecords } from './db/schema.js'
import { eq, sql, and, inArray } from 'drizzle-orm'

export interface ResolvedLink {
	href: string
	exists: boolean
}

/** Domains that WikiInternalLink falls through to when a know-domain link is unresolved */
const FALLTHROUGH_DOMAINS = ['celestial', 'calendar']

/**
 * For a given content record, fetch its outbound links from the content_links
 * table and resolve each to an href + existence flag by joining content_records.
 *
 * For unresolved know-domain links, also checks celestial/calendar domains
 * (matching the WikiInternalLink cross-domain fallthrough behavior).
 *
 * Returns a Map keyed by "domain:slug" (lowercase, e.g. "know:onchera").
 */
export async function getResolvedLinks(sourceId: number): Promise<Map<string, ResolvedLink>> {
	const rows = await db
		.select({
			targetDomain: contentLinks.targetDomain,
			targetSlug: contentLinks.targetSlug,
			targetId: contentLinks.targetId,
			// Join target record for parentPath and current slug (needed for URLs after moves)
			targetParentPath: contentRecords.parentPath,
			resolvedSlug: contentRecords.slug,
		})
		.from(contentLinks)
		.leftJoin(contentRecords, eq(contentLinks.targetId, contentRecords.id))
		.where(eq(contentLinks.sourceId, sourceId))

	const result = new Map<string, ResolvedLink>()

	// Collect unresolved know-domain slugs for cross-domain fallthrough
	const unresolvedKnowSlugs: string[] = []

	for (const row of rows) {
		const key = `${row.targetDomain}:${row.targetSlug.toLowerCase()}`
		const exists = row.targetId !== null
		// Use the actual record slug for the URL (handles moves), fall back to targetSlug for red links
		const hrefSlug = row.resolvedSlug ?? row.targetSlug
		const href = buildHref(row.targetDomain, hrefSlug, row.targetParentPath)
		result.set(key, { href, exists })

		if (!exists && row.targetDomain === 'know') {
			unresolvedKnowSlugs.push(row.targetSlug.toLowerCase())
		}
	}

	// Cross-domain fallthrough: check if unresolved know links exist in other domains
	if (unresolvedKnowSlugs.length > 0) {
		const crossDomainMatches = await db
			.select({
				domain: contentRecords.domain,
				slug: contentRecords.slug,
				parentPath: contentRecords.parentPath,
			})
			.from(contentRecords)
			.where(and(
				inArray(contentRecords.domain, FALLTHROUGH_DOMAINS),
				sql`LOWER(${contentRecords.slug}) IN (${sql.join(unresolvedKnowSlugs.map(s => sql`${s}`), sql`, `)})`,
			))

		for (const match of crossDomainMatches) {
			const lowerSlug = match.slug.toLowerCase()
			// Add as the fallthrough domain key so WikiInternalLink finds it
			const key = `${match.domain}:${lowerSlug}`
			if (!result.has(key)) {
				result.set(key, {
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
