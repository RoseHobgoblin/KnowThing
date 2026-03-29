import { db } from './db/index.js'
import { contentLinks, contentCategories, contentMediaUsage, contentRecords } from './db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { parseWikitext, extractLinksFromAst, extractDomainLinksFromAst, extractCategoriesFromAst, extractImagesFromAst, stripMarkup } from '$lib/parser/index.js'
import { slugify } from '$lib/renderer/context.js'
import type { WikiNode } from '$lib/parser/types.js'

/**
 * After saving content, update derived tables: links, categories, media_usage.
 * Returns the plain_text for FTS indexing and the parsed AST for caching.
 */
export async function updateContentEffects(
	contentRecordId: number,
	content: string,
	sourceDomain: string = 'know',
): Promise<{ plainText: string, ast: WikiNode }> {
	const ast = parseWikitext(content)
	const linkTargets = extractLinksFromAst(ast).map(t => slugify(t))
	const domainLinks = extractDomainLinksFromAst(ast)
	const cats = extractCategoriesFromAst(ast)
	const images = extractImagesFromAst(ast)
	const plainText = stripMarkup(content)

	// Update links
	await db.delete(contentLinks).where(eq(contentLinks.sourceId, contentRecordId))
	if (linkTargets.length > 0) {
		// Resolve target IDs where possible (for blue/red link detection)
		const targetRecords = await db
			.select({ id: contentRecords.id, slug: contentRecords.slug })
			.from(contentRecords)
			.where(sql`LOWER(${contentRecords.slug}) IN (${sql.join(linkTargets.map(t => sql`LOWER(${t})`), sql`, `)})`)

		const slugToId = new Map(targetRecords.map(r => [r.slug.toLowerCase(), r.id]))

		await db.insert(contentLinks).values(
			linkTargets.map(target => ({
				sourceId: contentRecordId,
				targetDomain: sourceDomain,
				targetSlug: target,
				targetId: slugToId.get(target.toLowerCase()) ?? null,
			})),
		).onConflictDoNothing()
	}

	// Store cross-domain links
	if (domainLinks.length > 0) {
		await db.insert(contentLinks).values(
			domainLinks.map(({ domain, target }) => ({
				sourceId: contentRecordId,
				targetDomain: domain,
				targetSlug: slugify(target),
				targetId: null, // resolved lazily
			})),
		).onConflictDoNothing()
	}

	// Update categories
	await db.delete(contentCategories).where(eq(contentCategories.contentRecordId, contentRecordId))
	if (cats.length > 0) {
		await db.insert(contentCategories).values(
			cats.map(category => ({ contentRecordId, category })),
		).onConflictDoNothing()
	}

	// Update media usage
	await db.delete(contentMediaUsage).where(eq(contentMediaUsage.contentRecordId, contentRecordId))
	if (images.length > 0) {
		await db.insert(contentMediaUsage).values(
			images.map(filename => ({ contentRecordId, filename })),
		).onConflictDoNothing()
	}

	return { plainText, ast }
}

/**
 * Clean up derived tables when content is deleted.
 */
export async function deleteContentEffects(contentRecordId: number): Promise<void> {
	await db.delete(contentLinks).where(eq(contentLinks.sourceId, contentRecordId))
	await db.delete(contentCategories).where(eq(contentCategories.contentRecordId, contentRecordId))
	await db.delete(contentMediaUsage).where(eq(contentMediaUsage.contentRecordId, contentRecordId))
}
