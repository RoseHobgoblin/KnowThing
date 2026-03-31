import { fail, isHttpError, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { requireEditor } from '$lib/server/guards.js'
import { createKnowPage } from '$lib/server/services/content.js'

export const load: PageServerLoad = async ({ url }) => {
	return {
		suggestedTitle: url.searchParams.get('title') || '',
		suggestedSlug: url.searchParams.get('slug') || '',
	}
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const formData = await event.request.formData()
		const title = formData.get('title')?.toString()?.trim()
		const content = formData.get('content')?.toString() || ''

		if (!title) {
			return fail(400, { error: 'Title is required', title, content })
		}

		try {
			const record = await createKnowPage({ title, content, userId: user.id })
			throw redirect(302, `/know/${record.slug}`)
		} catch (error: unknown) {
			if (error instanceof Response) throw error
			if (isHttpError(error) && error.status === 409) {
				return fail(409, { error: error.body?.message ?? error.message, title, content })
			}
			const message = error instanceof Error ? error.message : ''
			if (message.includes('unique') || message.includes('duplicate')) {
				return fail(409, { error: 'A page with this title already exists', title, content })
			}
			return fail(500, { error: 'Failed to create page', title, content })
		}
	},
}
