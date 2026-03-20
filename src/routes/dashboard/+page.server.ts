import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions } from '$lib/server/db/schema.js'
import { sql, eq, desc } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
	const [[pageCount], recentEdits] = await Promise.all([
		db.select({ count: sql<number>`count(*)::int` }).from(pages),
		db.select({
			pageSlug: revisions.pageSlug,
			title: revisions.title,
			editSummary: revisions.editSummary,
			createdAt: revisions.createdAt,
		})
			.from(revisions)
			.where(locals.user ? eq(revisions.userId, locals.user.id) : undefined)
			.orderBy(desc(revisions.createdAt))
			.limit(5),
	])

	return {
		pageCount: pageCount?.count ?? 0,
		recentEdits,
	}
}
