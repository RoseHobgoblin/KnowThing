import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { requireEditor } from '$lib/server/guards.js'
import { updateKnowPage } from '$lib/server/services/content.js'
import { getPageForEdit } from '$lib/server/services/pages.js'

export const load: PageServerLoad = async ({ params }) => {
	const record = await getPageForEdit('know', params.slug)
	return { slug: record.slug, title: record.title, content: record.content }
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const { slug } = event.params
		const formData = await event.request.formData()
		const content = formData.get('content')?.toString() || ''
		const editSummary = formData.get('summary')?.toString() || ''

		try {
			await updateKnowPage({ slug, content, editSummary, userId: user.id })
		} catch {
			return fail(500, { error: 'Failed to save article changes' })
		}

		throw redirect(302, `/know/${slug}`)
	},
}
