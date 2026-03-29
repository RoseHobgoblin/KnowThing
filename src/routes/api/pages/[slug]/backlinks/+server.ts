import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentLinks, contentRecords } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'

/** GET /api/pages/:slug/backlinks — content that links to this page */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db
		.select({
			slug: contentRecords.slug,
			title: contentRecords.title,
			domain: contentRecords.domain,
		})
		.from(contentLinks)
		.innerJoin(contentRecords, eq(contentLinks.sourceId, contentRecords.id))
		.where(sql`LOWER(${contentLinks.targetSlug}) = LOWER(${params.slug})`)

	return json(result)
}
