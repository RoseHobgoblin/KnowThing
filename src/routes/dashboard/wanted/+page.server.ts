import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { links, pages } from '$lib/server/db/schema.js'
import { sql, notInArray } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	// Find link targets that don't have a corresponding page
	const existingSlugs = db.select({ slug: pages.slug }).from(pages)

	const wanted = await db
		.select({
			slug: links.targetSlug,
			linkCount: sql<number>`count(*)::int`,
		})
		.from(links)
		.where(notInArray(links.targetSlug, existingSlugs))
		.groupBy(links.targetSlug)
		.orderBy(sql`count(*) DESC`)
		.limit(50)

	return { wanted }
}
