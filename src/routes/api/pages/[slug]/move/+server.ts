import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions, links, categories, mediaUsage } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'

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
		.from(pages)
		.where(eq(pages.slug, slug))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	// Check target doesn't already exist
	const [conflict] = await db
		.select({ id: pages.id })
		.from(pages)
		.where(eq(pages.slug, newSlug.trim()))
		.limit(1)

	if (conflict) {
		return json({ error: 'A page with that slug already exists' }, { status: 409 })
	}

	const title = newTitle?.trim() || existing.title

	// Update page
	await db
		.update(pages)
		.set({ slug: newSlug.trim(), title, updatedAt: new Date() })
		.where(eq(pages.slug, slug))

	// Update derived tables
	await db.update(revisions).set({ pageSlug: newSlug.trim() }).where(eq(revisions.pageSlug, slug))
	await db.update(links).set({ sourceSlug: newSlug.trim() }).where(eq(links.sourceSlug, slug))
	await db.update(categories).set({ pageSlug: newSlug.trim() }).where(eq(categories.pageSlug, slug))
	await db.update(mediaUsage).set({ pageSlug: newSlug.trim() }).where(eq(mediaUsage.pageSlug, slug))

	return json({ slug: newSlug.trim(), title })
}
