import { db } from './db/index.js'
import { contentLinks, contentRecords } from './db/schema.js'
import { eq, sql } from 'drizzle-orm'

export interface ResolvedLink {
	href: string
	exists: boolean
}

/**
 * For a given content record, fetch its outbound links from the content_links
 * table and resolve each to an href + existence flag by joining content_records.
 *
 * Returns a Map keyed by "domain:slug" (e.g. "know:onchera", "celestial:sunly-system").
 */
export async function getResolvedLinks(sourceId: number): Promise<Map<string, ResolvedLink>> {
	const rows = await db
		.select({
			targetDomain: contentLinks.targetDomain,
			targetSlug: contentLinks.targetSlug,
			targetId: contentLinks.targetId,
			// Join target record for parentPath (needed for hierarchical URLs)
			targetParentPath: contentRecords.parentPath,
		})
		.from(contentLinks)
		.leftJoin(contentRecords, eq(contentLinks.targetId, contentRecords.id))
		.where(eq(contentLinks.sourceId, sourceId))

	const result = new Map<string, ResolvedLink>()

	for (const row of rows) {
		const key = `${row.targetDomain}:${row.targetSlug}`
		const exists = row.targetId !== null
		const href = buildHref(row.targetDomain, row.targetSlug, row.targetParentPath)
		result.set(key, { href, exists })
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
