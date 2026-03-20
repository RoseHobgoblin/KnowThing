import { error, redirect, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types.js'
import { requireEditor } from '$lib/server/guards.js'
import { db } from '$lib/server/db/index.js'
import { pages, links, categories, mediaUsage, revisions } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { slugify } from '$lib/renderer/context.js'

export const load: PageServerLoad = async (event) => {
	requireEditor(event)

	const [page] = await db
		.select({ title: pages.title, slug: pages.slug })
		.from(pages)
		.where(eq(pages.slug, event.params.slug))
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
				.select({ id: pages.id })
				.from(pages)
				.where(eq(pages.slug, newSlug))
				.limit(1)

			if (existing) return fail(400, { error: `A page with slug "${newSlug}" already exists` })
		}

		// Get current page
		const [page] = await db
			.select()
			.from(pages)
			.where(eq(pages.slug, oldSlug))
			.limit(1)

		if (!page) throw error(404, 'Page not found')

		// Save a revision recording the move
		await db.insert(revisions).values({
			pageId: page.id,
			pageSlug: newSlug,
			title: newTitle,
			content: page.content,
			sizeBytes: page.sizeBytes,
			editSummary: `Moved from "${page.title}" (${oldSlug}) to "${newTitle}" (${newSlug})`,
			userId: user.id,
		})

		// Update the page itself
		await db
			.update(pages)
			.set({ slug: newSlug, title: newTitle, updatedAt: new Date() })
			.where(eq(pages.slug, oldSlug))

		// Update link references
		await db
			.update(links)
			.set({ sourceSlug: newSlug })
			.where(eq(links.sourceSlug, oldSlug))

		await db
			.update(links)
			.set({ targetSlug: newSlug })
			.where(eq(links.targetSlug, oldSlug))

		// Update categories
		await db
			.update(categories)
			.set({ pageSlug: newSlug })
			.where(eq(categories.pageSlug, oldSlug))

		// Update media usage
		await db
			.update(mediaUsage)
			.set({ pageSlug: newSlug })
			.where(eq(mediaUsage.pageSlug, oldSlug))

		// Update old revision slugs
		await db
			.update(revisions)
			.set({ pageSlug: newSlug })
			.where(eq(revisions.pageSlug, oldSlug))

		throw redirect(302, `/know/${newSlug}`)
	},
}
