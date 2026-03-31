import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireEditor } from '$lib/server/guards.js'
import { updateKnowPage } from '$lib/server/services/content.js'

export const load: PageServerLoad = async ({ params }) => {
	const [record] = await db
		.select({ id: contentRecords.id, slug: contentRecords.slug, title: contentRecords.title, content: contentRecords.content })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, params.slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')

	return { slug: record.slug, title: record.title, content: record.content }
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const { slug } = event.params
		const formData = await event.request.formData()
		const content = formData.get('content')?.toString() || ''
		const editSummary = formData.get('summary')?.toString() || ''
		await updateKnowPage({ slug, content, editSummary, userId: user.id })

		throw redirect(302, `/know/${slug}`)
	},
}
