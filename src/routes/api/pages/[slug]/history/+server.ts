import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions, users } from '$lib/server/db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'

/** GET /api/pages/:slug/history?domain=know — revision list */
export const GET: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const { params, url } = event
	const domain = url.searchParams.get('domain') || 'know'
	const [record] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, params.slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')

	const result = await db
		.select({
			id: contentRevisions.id,
			title: contentRevisions.title,
			sizeBytes: contentRevisions.sizeBytes,
			editSummary: contentRevisions.editSummary,
			username: users.username,
			createdAt: contentRevisions.createdAt,
		})
		.from(contentRevisions)
		.leftJoin(users, eq(contentRevisions.userId, users.id))
		.where(eq(contentRevisions.contentRecordId, record.id))
		.orderBy(desc(contentRevisions.createdAt))

	return json(result)
}
