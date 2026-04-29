import { redirect, fail, isHttpError } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types.js'
import { requireEditor } from '$lib/server/guards.js'
import { slugify } from '$lib/renderer/context.js'
import { moveKnowPage } from '$lib/server/services/content.js'
import { getPageForEdit } from '$lib/server/services/pages.js'

export const load: PageServerLoad = async (event) => {
	requireEditor(event)
	const page = await getPageForEdit('know', event.params.slug)
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
