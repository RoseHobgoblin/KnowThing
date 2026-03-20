import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { categories } from '$lib/server/db/schema.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const cats = await db
		.select({
			name: categories.category,
			count: sql<number>`count(*)::int`,
		})
		.from(categories)
		.groupBy(categories.category)
		.orderBy(categories.category)

	return { categories: cats }
}
