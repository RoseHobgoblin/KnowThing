import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { revisions, users } from '$lib/server/db/schema.js'
import { eq, desc } from 'drizzle-orm'

/** GET /api/pages/:slug/history — revision list */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db
		.select({
			id: revisions.id,
			title: revisions.title,
			sizeBytes: revisions.sizeBytes,
			editSummary: revisions.editSummary,
			username: users.username,
			createdAt: revisions.createdAt,
		})
		.from(revisions)
		.leftJoin(users, eq(revisions.userId, users.id))
		.where(eq(revisions.pageSlug, params.slug))
		.orderBy(desc(revisions.createdAt))

	return json(result)
}
