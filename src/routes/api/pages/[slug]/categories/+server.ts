import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { categories } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'

/** GET /api/pages/:slug/categories */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db
		.select({ category: categories.category })
		.from(categories)
		.where(eq(categories.pageSlug, params.slug))

	return json(result.map(r => r.category))
}
