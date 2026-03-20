import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'
import { updatePageEffects } from '$lib/server/page-effects.js'

export const load: PageServerLoad = async ({ params }) => {
	const [page] = await db
		.select({ slug: pages.slug, title: pages.title, content: pages.content })
		.from(pages)
		.where(eq(pages.slug, params.slug))
		.limit(1)

	if (!page) throw error(404, 'Page not found')

	return { slug: page.slug, title: page.title, content: page.content }
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
			.from(pages)
			.where(eq(pages.slug, slug))
			.limit(1)

		if (!existing) throw error(404, 'Page not found')

		const sizeBytes = new TextEncoder().encode(content).length
		const plainText = await updatePageEffects(slug, content)

		await db
			.update(pages)
			.set({ content, plainText, sizeBytes, updatedAt: new Date() })
			.where(eq(pages.slug, slug))

		await db.insert(revisions).values({
			pageId: existing.id,
			pageSlug: slug,
			title: existing.title,
			content,
			sizeBytes,
			editSummary,
			userId: user.id,
		})

		throw redirect(302, `/know/${slug}`)
	},
}
