import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentCategories } from '$lib/server/db/schema.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const cats = await db
		.select({
			name: contentCategories.category,
			count: sql<number>`count(*)::int`,
		})
		.from(contentCategories)
		.groupBy(contentCategories.category)
		.orderBy(contentCategories.category)

	return { categories: cats }
}
