import { db } from './db/index.js'
import { links, categories, mediaUsage } from './db/schema.js'
import { eq } from 'drizzle-orm'
import { parseWikitext, extractLinksFromAst, extractCategoriesFromAst, extractImagesFromAst, stripMarkup } from '$lib/parser/index.js'
import { slugify } from '$lib/renderer/context.js'

/**
 * After saving a page, update derived tables: links, categories, media_usage.
 * Returns the plain_text for FTS indexing.
 */
export async function updatePageEffects(
	pageSlug: string,
	content: string,
): Promise<string> {
	// Extract metadata from wikitext (parse once, walk AST for each extraction)
	const ast = parseWikitext(content)
	const linkTargets = extractLinksFromAst(ast).map(t => slugify(t))
	const cats = extractCategoriesFromAst(ast)
	const images = extractImagesFromAst(ast)
	const plainText = stripMarkup(content)

	// Update links
	await db.delete(links).where(eq(links.sourceSlug, pageSlug))
	if (linkTargets.length > 0) {
		await db.insert(links).values(
			linkTargets.map(target => ({ sourceSlug: pageSlug, targetSlug: target })),
		).onConflictDoNothing()
	}

	// Update categories
	await db.delete(categories).where(eq(categories.pageSlug, pageSlug))
	if (cats.length > 0) {
		await db.insert(categories).values(
			cats.map(cat => ({ pageSlug, category: cat })),
		).onConflictDoNothing()
	}

	// Update media usage
	await db.delete(mediaUsage).where(eq(mediaUsage.pageSlug, pageSlug))
	if (images.length > 0) {
		await db.insert(mediaUsage).values(
			images.map(filename => ({ pageSlug, filename })),
		).onConflictDoNothing()
	}

	return plainText
}

/**
 * Clean up derived tables when a page is deleted.
 */
export async function deletePageEffects(pageSlug: string): Promise<void> {
	await db.delete(links).where(eq(links.sourceSlug, pageSlug))
	await db.delete(categories).where(eq(categories.pageSlug, pageSlug))
	await db.delete(mediaUsage).where(eq(mediaUsage.pageSlug, pageSlug))
}
