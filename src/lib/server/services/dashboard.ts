import { countDistinct, desc, eq, max, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	contentCategories,
	contentLinks,
	contentRecords,
	contentRevisions,
	media,
	users,
} from '$lib/server/db/schema.js'

export async function pickRandomPage() {
	const [randomPage] = await db
		.select({
			domain: contentRecords.domain,
			slug: contentRecords.slug,
			parentPath: contentRecords.parentPath,
		})
		.from(contentRecords)
		.orderBy(sql`RANDOM()`)
		.limit(1)
	return randomPage ?? null
}

export async function listOrphanedPages() {
	const linkedIds = db
		.selectDistinct({ id: contentLinks.targetId })
		.from(contentLinks)
		.where(sql`${contentLinks.targetId} IS NOT NULL`)

	return db
		.select({
			domain: contentRecords.domain,
			slug: contentRecords.slug,
			title: contentRecords.title,
			parentPath: contentRecords.parentPath,
			updatedAt: contentRecords.updatedAt,
		})
		.from(contentRecords)
		.where(sql`${contentRecords.id} NOT IN (${linkedIds})`)
		.orderBy(contentRecords.domain, contentRecords.title)
}

export async function listWantedPages(limit = 50) {
	return db
		.select({
			domain: contentLinks.targetDomain,
			slug: contentLinks.targetSlug,
			linkCount: sql<number>`count(*)::int`,
		})
		.from(contentLinks)
		.where(sql`${contentLinks.targetId} IS NULL`)
		.groupBy(contentLinks.targetDomain, contentLinks.targetSlug)
		.orderBy(sql`count(*) DESC`)
		.limit(limit)
}

export async function listRecentEdits({ page, perPage }: { page: number, perPage: number }) {
	const offset = (page - 1) * perPage
	return db
		.select({
			id: contentRevisions.id,
			domain: contentRecords.domain,
			pageSlug: contentRecords.slug,
			parentPath: contentRecords.parentPath,
			title: contentRevisions.title,
			editSummary: contentRevisions.editSummary,
			sizeBytes: contentRevisions.sizeBytes,
			createdAt: contentRevisions.createdAt,
			username: users.username,
		})
		.from(contentRevisions)
		.innerJoin(contentRecords, eq(contentRevisions.contentRecordId, contentRecords.id))
		.leftJoin(users, eq(contentRevisions.userId, users.id))
		.orderBy(desc(contentRevisions.createdAt))
		.limit(perPage)
		.offset(offset)
}

export async function getKnowExportSummary() {
	const [[pageCount], [mediaCount]] = await Promise.all([
		db.select({ count: sql<number>`count(*)::int` }).from(contentRecords).where(eq(contentRecords.domain, 'know')),
		db.select({ count: sql<number>`count(*)::int` }).from(media),
	])
	return {
		pageCount: pageCount?.count ?? 0,
		mediaCount: mediaCount?.count ?? 0,
	}
}

export async function exportKnowPages() {
	return db
		.select({ slug: contentRecords.slug, title: contentRecords.title, content: contentRecords.content })
		.from(contentRecords)
		.where(eq(contentRecords.domain, 'know'))
}

export async function getSiteStats() {
	const [[pageStats], [revisionStats], [categoryStats], [mediaStats]] = await Promise.all([
		db.select({
			count: sql<number>`count(*)::int`,
			totalSize: sql<number>`coalesce(sum(${contentRecords.sizeBytes}), 0)::int`,
			lastEdit: max(contentRecords.updatedAt),
		}).from(contentRecords).where(eq(contentRecords.domain, 'know')),

		db.select({
			count: sql<number>`count(*)::int`,
		}).from(contentRevisions)
			.innerJoin(contentRecords, eq(contentRevisions.contentRecordId, contentRecords.id))
			.where(eq(contentRecords.domain, 'know')),

		db.select({
			count: countDistinct(contentCategories.category),
		}).from(contentCategories)
			.innerJoin(contentRecords, eq(contentCategories.contentRecordId, contentRecords.id))
			.where(eq(contentRecords.domain, 'know')),

		db.select({
			count: sql<number>`count(*)::int`,
			totalSize: sql<number>`coalesce(sum(size_bytes), 0)::int`,
		}).from(media),
	])

	return {
		articles: pageStats?.count ?? 0,
		totalContentSize: pageStats?.totalSize ?? 0,
		lastEdit: pageStats?.lastEdit?.toISOString() ?? null,
		revisions: revisionStats?.count ?? 0,
		categories: categoryStats?.count ?? 0,
		mediaFiles: mediaStats?.count ?? 0,
		mediaTotalSize: mediaStats?.totalSize ?? 0,
	}
}

export async function listAllCategories() {
	return db
		.select({
			name: contentCategories.category,
			count: sql<number>`count(*)::int`,
		})
		.from(contentCategories)
		.groupBy(contentCategories.category)
		.orderBy(contentCategories.category)
}
