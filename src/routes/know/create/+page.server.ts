import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { updatePageEffects } from '$lib/server/page-effects.js'
import { slugify } from '$lib/renderer/context.js'

export const load: PageServerLoad = async ({ url }) => {
	return {
		suggestedTitle: url.searchParams.get('title') || '',
		suggestedSlug: url.searchParams.get('slug') || '',
	}
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event)
		const formData = await event.request.formData()
		const title = formData.get('title')?.toString()?.trim()
		const content = formData.get('content')?.toString() || ''

		if (!title) {
			return fail(400, { error: 'Title is required', title, content })
		}

		const slug = slugify(title)
		const sizeBytes = new TextEncoder().encode(content).length
		const plainText = await updatePageEffects(slug, content)

		try {
			const [page] = await db
				.insert(pages)
				.values({ slug, title, content, plainText, sizeBytes })
				.returning()

			await db.insert(revisions).values({
				pageId: page.id,
				pageSlug: slug,
				title,
				content,
				sizeBytes,
				editSummary: 'Page created',
				userId: user.id,
			})
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : ''
			if (message.includes('unique') || message.includes('duplicate')) {
				return fail(409, { error: 'A page with this title already exists', title, content })
			}
			return fail(500, { error: 'Failed to create page', title, content })
		}

		throw redirect(302, `/know/${slug}`)
	},
}
