import { error, redirect, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types.js'
import { requireEditor } from '$lib/server/guards.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentLinks, contentRevisions } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { slugify } from '$lib/renderer/context.js'
import { updateContentEffects } from '$lib/server/content-effects.js'

export const load: PageServerLoad = async (event) => {
	requireEditor(event)

	const [page] = await db
		.select({ title: contentRecords.title, slug: contentRecords.slug })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, event.params.slug)))
		.limit(1)

	if (!page) throw error(404, 'Page not found')

	return { title: page.title, slug: page.slug }
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const oldSlug = event.params.slug
		const formData = await event.request.formData()
		const newTitle = (formData.get('title') as string)?.trim()
		const newSlug = (formData.get('slug') as string)?.trim() || slugify(newTitle || '')

		if (!newTitle) return fail(400, { error: 'Title is required' })
		if (!newSlug) return fail(400, { error: 'Slug is required' })

		// Check if target slug already exists (and isn't the same page)
		if (newSlug !== oldSlug) {
			const [existing] = await db
				.select({ id: contentRecords.id })
				.from(contentRecords)
				.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, newSlug)))
				.limit(1)

			if (existing) return fail(400, { error: `A page with slug "${newSlug}" already exists` })
		}

		// Get current page
		const [page] = await db
			.select()
			.from(contentRecords)
			.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, oldSlug)))
			.limit(1)

		if (!page) throw error(404, 'Page not found')

		// Save a revision recording the move
		await db.insert(contentRevisions).values({
			contentRecordId: page.id,
			title: newTitle,
			content: page.content,
			sizeBytes: page.sizeBytes,
			editSummary: `Moved from "${page.title}" (${oldSlug}) to "${newTitle}" (${newSlug})`,
			userId: user.id,
		})

		// Update the page itself
		await db
			.update(contentRecords)
			.set({ slug: newSlug, title: newTitle, updatedAt: new Date() })
			.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, oldSlug)))

		// Update link references: update targetSlug and targetId for links pointing to the old slug
		await db
			.update(contentLinks)
			.set({ targetSlug: newSlug, targetId: page.id })
			.where(and(eq(contentLinks.targetDomain, 'know'), eq(contentLinks.targetSlug, oldSlug)))

		// Re-derive links, categories, media from content
		await updateContentEffects(page.id, page.content, 'know')

		throw redirect(302, `/know/${newSlug}`)
	},
}
