import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { pages, revisions, categories, media } from '$lib/server/db/schema.js';
import { sql, countDistinct, max } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [[pageStats], [revisionStats], [categoryStats], [mediaStats]] = await Promise.all([
		db.select({
			count: sql<number>`count(*)::int`,
			totalSize: sql<number>`coalesce(sum(size_bytes), 0)::int`,
			lastEdit: max(pages.updatedAt)
		}).from(pages),

		db.select({
			count: sql<number>`count(*)::int`
		}).from(revisions),

		db.select({
			count: countDistinct(categories.category)
		}).from(categories),

		db.select({
			count: sql<number>`count(*)::int`,
			totalSize: sql<number>`coalesce(sum(size_bytes), 0)::int`
		}).from(media)
	]);

	return {
		stats: {
			articles: pageStats?.count ?? 0,
			totalContentSize: pageStats?.totalSize ?? 0,
			lastEdit: pageStats?.lastEdit?.toISOString() ?? null,
			revisions: revisionStats?.count ?? 0,
			categories: categoryStats?.count ?? 0,
			mediaFiles: mediaStats?.count ?? 0,
			mediaTotalSize: mediaStats?.totalSize ?? 0
		}
	};
};
