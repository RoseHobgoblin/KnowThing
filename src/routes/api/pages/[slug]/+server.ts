import { json, error } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'
import { updatePageEffects, deletePageEffects } from '$lib/server/page-effects.js'

const updatePageSchema = z.object({
	content: z.string(),
	title: z.string().min(1).optional(),
	editSummary: z.string().optional(),
})

/** GET /api/pages/:slug */
export const GET: RequestHandler = async ({ params }) => {
	const [page] = await db
		.select()
		.from(pages)
		.where(eq(pages.slug, params.slug))
		.limit(1)

	if (!page) throw error(404, 'Page not found')
	return json(page)
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
		.from(pages)
		.where(eq(pages.slug, slug))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	const sizeBytes = new TextEncoder().encode(content).length
	const { plainText, ast } = await updatePageEffects(slug, content)

	const [updated] = await db
		.update(pages)
		.set({
			title: title?.trim() || existing.title,
			content,
			plainText,
			parsedAst: ast,
			sizeBytes,
			updatedAt: new Date(),
		})
		.where(eq(pages.slug, slug))
		.returning()

	// Save revision
	await db.insert(revisions).values({
		pageId: existing.id,
		pageSlug: slug,
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
	requireAuth(event)
	const { slug } = event.params

	const [existing] = await db
		.select({ id: pages.id })
		.from(pages)
		.where(eq(pages.slug, slug))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	await deletePageEffects(slug)
	await db.delete(pages).where(eq(pages.slug, slug))

	return json({ ok: true })
}
