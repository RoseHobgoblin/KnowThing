import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { parseWikitext } from '$lib/parser/index.js'
import { getResolvedLinks, serializeResolvedLinks } from '$lib/server/resolved-links.js'
import { backfillLinkTargets } from '$lib/server/content-effects.js'
import type { WikiNode } from '$lib/parser/types.js'
import type { ContentRecordsDatabase } from '$lib/server/services/content-records.js'

export interface LoadArticlePageOptions {
	domain: string
	slug: string
	title: string
	parentPath?: string | null
}

export interface ArticlePage {
	wikiContent: string
	ast: WikiNode | null
	contentRecordId: number
	resolvedLinks: Record<string, { href: string, exists: boolean }>
}

const RECORD_COLUMNS = {
	id: contentRecords.id,
	content: contentRecords.content,
	parsedAst: contentRecords.parsedAst,
	parentPath: contentRecords.parentPath,
	title: contentRecords.title,
}

/**
 * Load (or create on first read) the article for a given (domain, slug).
 * Replaces the per-domain ensureXContent + loadXContent pair.
 */
export async function loadArticlePage(options: LoadArticlePageOptions): Promise<ArticlePage> {
	const { domain, slug, title, parentPath = null } = options

	let record = await selectByDomainSlug(db, domain, slug)

	if (!record) {
		record = await db.transaction(async (tx) => {
			const existing = await selectByDomainSlug(tx, domain, slug)
			if (existing) return existing

			const [created] = await tx
				.insert(contentRecords)
				.values({
					domain,
					slug,
					parentPath,
					title,
					content: '',
					plainText: '',
					sizeBytes: 0,
				})
				.returning(RECORD_COLUMNS)

			await backfillLinkTargets(tx, created.id, domain, slug)
			return created
		})
	} else if (record.parentPath !== parentPath || record.title !== title) {
		await db
			.update(contentRecords)
			.set({ parentPath, title, updatedAt: new Date() })
			.where(eq(contentRecords.id, record.id))
	}

	const ast = (record.parsedAst as WikiNode | null) ?? (record.content ? parseWikitext(record.content) : null)
	const links = await getResolvedLinks(record.id)

	return {
		wikiContent: record.content,
		ast,
		contentRecordId: record.id,
		resolvedLinks: serializeResolvedLinks(links),
	}
}

async function selectByDomainSlug(database: ContentRecordsDatabase, domain: string, slug: string) {
	const [row] = await database
		.select(RECORD_COLUMNS)
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
		))
	return row ?? null
}
