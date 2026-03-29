import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'
import { updateContentEffects } from '$lib/server/content-effects.js'

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
		const user = requireAuth(event)
		const { slug } = event.params
		const formData = await event.request.formData()
		const content = formData.get('content')?.toString() || ''
		const editSummary = formData.get('summary')?.toString() || ''

		const [existing] = await db
			.select()
			.from(contentRecords)
			.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))
			.limit(1)

		if (!existing) throw error(404, 'Page not found')

		const sizeBytes = new TextEncoder().encode(content).length
		const { plainText, ast } = await updateContentEffects(existing.id, content)

		await db
			.update(contentRecords)
			.set({ content, plainText, parsedAst: ast, sizeBytes, updatedAt: new Date() })
			.where(eq(contentRecords.id, existing.id))

		await db.insert(contentRevisions).values({
			contentRecordId: existing.id,
			title: existing.title,
			content,
			sizeBytes,
			editSummary,
			userId: user.id,
		})

		throw redirect(302, `/know/${slug}`)
	},
}
