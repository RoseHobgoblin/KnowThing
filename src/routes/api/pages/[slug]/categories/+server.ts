import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentCategories, contentRecords } from '$lib/server/db/schema.js'
import { eq, and, sql } from 'drizzle-orm'

/** GET /api/pages/:slug/categories?domain=know */
export const GET: RequestHandler = async ({ params, url }) => {
	const domain = url.searchParams.get('domain') || 'know'
	const result = await db
		.select({ category: contentCategories.category })
		.from(contentCategories)
		.innerJoin(contentRecords, eq(contentCategories.contentRecordId, contentRecords.id))
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${params.slug})`,
		))

	return json(result.map(r => r.category))
}
