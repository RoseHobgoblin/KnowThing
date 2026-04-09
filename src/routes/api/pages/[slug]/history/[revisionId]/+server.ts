import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'

/** GET /api/pages/:slug/history/:revisionId — get specific revision */
export const GET: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const { params } = event

	const id = Number.parseInt(params.revisionId)
	if (isNaN(id)) throw error(400, 'Invalid revision ID')

	// Look up the content record for this slug to verify ownership
	const domain = event.url.searchParams.get('domain') || 'know'
	const [record] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, params.slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')

	const [rev] = await db
		.select()
		.from(contentRevisions)
		.where(and(eq(contentRevisions.id, id), eq(contentRevisions.contentRecordId, record.id)))
		.limit(1)

	if (!rev) throw error(404, 'Revision not found')
	return json(rev)
}
