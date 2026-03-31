import { json, error } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireAuth, requireRole } from '$lib/server/auth.js'
import { updateContentEffects, deleteContentEffects } from '$lib/server/content-effects.js'

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
	const user = requireAuth(event)
	const { slug } = event.params
	const body = await event.request.json()
	const parsed = updatePageSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}
	const { title, content, editSummary } = parsed.data

	const [existing] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	const sizeBytes = new TextEncoder().encode(content).length
	const { plainText, ast } = await updateContentEffects(existing.id, content)

	const [updated] = await db
		.update(contentRecords)
		.set({
			title: title?.trim() || existing.title,
			content,
			plainText,
			parsedAst: ast,
			sizeBytes,
			updatedAt: new Date(),
		})
		.where(eq(contentRecords.id, existing.id))
		.returning()

	await db.insert(contentRevisions).values({
		contentRecordId: existing.id,
		title: updated.title,
		content,
		sizeBytes,
		editSummary: editSummary || '',
		userId: user.id,
	})

	return json(updated)
}

/** DELETE /api/pages/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
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
