import { json, error } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireEditorUser } from '$lib/server/auth.js'
import { deleteContentEffects } from '$lib/server/content-effects.js'
import { updateKnowPage } from '$lib/server/services/content.js'

const updatePageSchema = z.object({
	content: z.string(),
	title: z.string().min(1).optional(),
	editSummary: z.string().optional(),
})

/** GET /api/pages/:slug */
export const GET: RequestHandler = async ({ params }) => {
	const [record] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, params.slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')
	return json(record)
}

/** PUT /api/pages/:slug — update page */
export const PUT: RequestHandler = async (event) => {
	const user = requireEditorUser(event)
	const { slug } = event.params
	const body = await event.request.json()
	const parsed = updatePageSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}
	const { title, content, editSummary } = parsed.data

	const updated = await updateKnowPage({
		slug,
		title,
		content,
		editSummary,
		userId: user.id,
	})

	return json(updated)
}

/** DELETE /api/pages/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireEditorUser(event)
	const { slug } = event.params

	const [existing] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	await deleteContentEffects(existing.id)
	await db.delete(contentRecords).where(eq(contentRecords.id, existing.id))

	return json({ ok: true })
}
