import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions, contentCategories, media } from '$lib/server/db/schema.js'
import { sql, eq, countDistinct, max } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
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
		stats: {
			articles: pageStats?.count ?? 0,
			totalContentSize: pageStats?.totalSize ?? 0,
			lastEdit: pageStats?.lastEdit?.toISOString() ?? null,
			revisions: revisionStats?.count ?? 0,
			categories: categoryStats?.count ?? 0,
			mediaFiles: mediaStats?.count ?? 0,
			mediaTotalSize: mediaStats?.totalSize ?? 0,
		},
	}
}
