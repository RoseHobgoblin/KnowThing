import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'
import { deleteContentEffects } from '$lib/server/content-effects.js'
import { updateKnowPage } from '$lib/server/services/content.js'
import { parseBody } from '$lib/server/utils.js'
import { z } from 'zod'

const updatePageSchema = z.object({
	content: z.string(),
	title: z.string().min(1).optional(),
	editSummary: z.string().optional(),
})

/** GET /api/pages/:slug?domain=know */
export const GET: RequestHandler = async ({ params, url }) => {
	const domain = url.searchParams.get('domain') || 'know'
	const [record] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, params.slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')
	return json(record)
}

/** PUT /api/pages/:slug — update page */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const { slug } = event.params
	const data = await parseBody(event.request, updatePageSchema)
	if (data instanceof Response) return data
	const { title, content, editSummary } = data

	const updated = await updateKnowPage({
		slug,
		title,
		content,
		editSummary,
		userId: user.id,
	})

	return json(updated)
}

/** DELETE /api/pages/:slug?domain=know */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const { slug } = event.params
	const domain = event.url.searchParams.get('domain') || 'know'

	const [existing] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	await deleteContentEffects(existing.id)
	await db.delete(contentRecords).where(eq(contentRecords.id, existing.id))

	return json({ ok: true })
}
