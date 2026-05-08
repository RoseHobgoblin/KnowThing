import { db } from './db/index.js'
import { contentLinks, contentCategories, contentMediaUsage, contentRecords } from './db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { parseWikitext, extractLinksFromAst, extractDomainLinksFromAst, extractCategoriesFromAst, extractImagesFromAst, extractPlainTextFromAst } from '$lib/parser/index.js'
import { slugify } from '$lib/renderer/context.js'
import type { WikiNode } from '$lib/parser/types.js'

export type ContentEffectsDatabase = Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'>

export type EntitySource = { kind: string, entityId: number }

/**
 * After saving content, update derived tables: links, categories, media_usage.
 * Returns the plain_text for FTS indexing and the parsed AST for caching.
 *
 * The source can be either a Know-domain content_records row (numeric id) or
 * a structured-entity row (`{ kind, entityId }`). Categories and media_usage
 * still key on `contentRecordId` and so are only refreshed for know sources.
 */
export async function updateContentEffects(
	database: ContentEffectsDatabase,
	contentRecordId: number,
	content: string,
	sourceDomain: string = 'know',
	entitySource?: EntitySource,
): Promise<{ plainText: string, ast: WikiNode }> {
	const ast = parseWikitext(content)
	const linkTargets = extractLinksFromAst(ast).map(t => slugify(t))
	const domainLinks = extractDomainLinksFromAst(ast)
	const cats = extractCategoriesFromAst(ast)
	const images = extractImagesFromAst(ast)
	const plainText = extractPlainTextFromAst(ast)

	const sourceKind = entitySource?.kind ?? 'know'
	const sourceEntityId = entitySource?.entityId ?? contentRecordId

	// Update links — clear all rows from this source first, then reinsert.
	await database.delete(contentLinks).where(and(
		eq(contentLinks.sourceKind, sourceKind),
		eq(contentLinks.sourceEntityId, sourceEntityId),
	))

	if (linkTargets.length > 0) {
		// Resolve target IDs within the source domain so internal links stay domain-relative.
		const targetRecords = await database
			.select({ id: contentRecords.id, slug: contentRecords.slug })
			.from(contentRecords)
			.where(sql`${contentRecords.domain} = ${sourceDomain} AND LOWER(${contentRecords.slug}) IN (${sql.join(linkTargets.map(t => sql`LOWER(${t})`), sql`, `)})`)

		const slugToId = new Map(targetRecords.map(r => [r.slug.toLowerCase(), r.id]))

		await database.insert(contentLinks).values(
			linkTargets.map(target => ({
				sourceId: sourceKind === 'know' ? contentRecordId : null,
				sourceKind,
				sourceEntityId,
				targetDomain: sourceDomain,
				targetSlug: target,
				targetId: slugToId.get(target.toLowerCase()) ?? null,
			})),
		).onConflictDoNothing()
	}

	// Store cross-domain / namespaced links. Identifiers are stored verbatim
	// (case-insensitive matching is the responsibility of the resolver).
	if (domainLinks.length > 0) {
		const domainSlugPairs = domainLinks.map(({ domain, target }) => ({ domain, slug: target.trim() }))

		// Batch-resolve targets across domains
		const domainTargetRecords = await database
			.select({ id: contentRecords.id, domain: contentRecords.domain, slug: contentRecords.slug })
			.from(contentRecords)
			.where(sql`(${sql.join(
				domainSlugPairs.map(p => sql`(${contentRecords.domain} = ${p.domain} AND LOWER(${contentRecords.slug}) = LOWER(${p.slug}))`),
				sql` OR `,
			)})`)

		const domainSlugToId = new Map(domainTargetRecords.map(r => [`${r.domain}:${r.slug.toLowerCase()}`, r.id]))

		await database.insert(contentLinks).values(
			domainSlugPairs.map(({ domain, slug: targetSlug }) => ({
				sourceId: sourceKind === 'know' ? contentRecordId : null,
				sourceKind,
				sourceEntityId,
				targetDomain: domain,
				targetSlug,
				targetId: domainSlugToId.get(`${domain}:${targetSlug.toLowerCase()}`) ?? null,
			})),
		).onConflictDoNothing()
	}

	// Categories and media_usage still key on contentRecordId, so they only
	// apply to know-domain sources for now (Phase 7 generalises categories via
	// entity_categories).
	if (sourceKind === 'know') {
		await database.delete(contentCategories).where(eq(contentCategories.contentRecordId, contentRecordId))
		if (cats.length > 0) {
			await database.insert(contentCategories).values(
				cats.map(category => ({ contentRecordId, category })),
			).onConflictDoNothing()
		}

		await database.delete(contentMediaUsage).where(eq(contentMediaUsage.contentRecordId, contentRecordId))
		if (images.length > 0) {
			await database.insert(contentMediaUsage).values(
				images.map(filename => ({ contentRecordId, filename })),
			).onConflictDoNothing()
		}
	}

	return { plainText, ast }
}

/**
 * Clean up derived tables when content is deleted.
 */
export async function deleteContentEffects(
	database: ContentEffectsDatabase,
	contentRecordId: number,
): Promise<void> {
	await database.delete(contentLinks).where(eq(contentLinks.sourceId, contentRecordId))
	await database.delete(contentCategories).where(eq(contentCategories.contentRecordId, contentRecordId))
	await database.delete(contentMediaUsage).where(eq(contentMediaUsage.contentRecordId, contentRecordId))
}

/**
 * When a new content record is created, backfill targetId on any existing
 * content_links rows that point at this record's domain+slug but had
 * targetId = NULL (i.e. red links that should now become blue).
 */
export async function backfillLinkTargets(
	database: ContentEffectsDatabase,
	recordId: number,
	domain: string,
	slug: string,
): Promise<void> {
	await database
		.update(contentLinks)
		.set({ targetId: recordId })
		.where(
			and(
				eq(contentLinks.targetDomain, domain),
				sql`LOWER(${contentLinks.targetSlug}) = LOWER(${slug})`,
				sql`${contentLinks.targetId} IS NULL`,
			),
		)
}
