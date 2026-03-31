import { error, redirect, fail, isHttpError } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types.js'
import { requireEditor } from '$lib/server/guards.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { slugify } from '$lib/renderer/context.js'
import { moveKnowPage } from '$lib/server/services/content.js'

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

		if (!newTitle) return fail(400, { error: 'Title is required', title: newTitle ?? '', slug: newSlug })
		if (!newSlug) return fail(400, { error: 'Slug is required', title: newTitle, slug: newSlug ?? '' })

		try {
			await moveKnowPage({ slug: oldSlug, newTitle, newSlug, userId: user.id })
		} catch (error_: unknown) {
			if (isHttpError(error_) && error_.status === 409) {
				return fail(409, { error: error_.body?.message ?? error_.message, title: newTitle, slug: newSlug })
			}
			throw error_
		}

		throw redirect(302, `/know/${newSlug}`)
	},
}
