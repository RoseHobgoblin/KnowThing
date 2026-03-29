import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions, contentLinks } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'
import { updateContentEffects } from '$lib/server/content-effects.js'

/** POST /api/pages/:slug/move — rename/move page */
export const POST: RequestHandler = async (event) => {
	requireAuth(event)
	const { slug } = event.params
	const body = await event.request.json()
	const { newSlug, newTitle } = body as { newSlug: string, newTitle?: string }

	if (!newSlug?.trim()) {
		return json({ error: 'newSlug is required' }, { status: 400 })
	}

	const [existing] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	// Check target doesn't already exist
	const [conflict] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, newSlug.trim())))
		.limit(1)

	if (conflict) {
		return json({ error: 'A page with that slug already exists' }, { status: 409 })
	}

	const title = newTitle?.trim() || existing.title

	// Update page
	await db
		.update(contentRecords)
		.set({ slug: newSlug.trim(), title, updatedAt: new Date() })
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))

	// Update link references pointing to old slug
	await db
		.update(contentLinks)
		.set({ targetSlug: newSlug.trim(), targetId: existing.id })
		.where(and(eq(contentLinks.targetDomain, 'know'), eq(contentLinks.targetSlug, slug)))

	// Re-derive outgoing links, categories, media from content
	await updateContentEffects(existing.id, existing.content, 'know')

	return json({ slug: newSlug.trim(), title })
}
