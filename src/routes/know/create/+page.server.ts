import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, and, sql, ne } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'
import { updateContentEffects } from '$lib/server/content-effects.js'
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

		// Block creation if slug collides with another domain (celestial, calendar)
		const [collision] = await db
			.select({ domain: contentRecords.domain })
			.from(contentRecords)
			.where(and(
				sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
				ne(contentRecords.domain, 'know'),
			))
			.limit(1)

		if (collision) {
			return fail(409, { error: `A ${collision.domain} entry with this name already exists. Use [[${collision.domain}:${title}]] to link to it.`, title, content })
		}

		const sizeBytes = new TextEncoder().encode(content).length

		try {
			const [record] = await db
				.insert(contentRecords)
				.values({ domain: 'know', slug, title, content, plainText: '', sizeBytes })
				.returning()

			const { plainText, ast } = await updateContentEffects(record.id, content)

			await db
				.update(contentRecords)
				.set({ plainText, parsedAst: ast })
				.where(eq(contentRecords.id, record.id))

			await db.insert(contentRevisions).values({
				contentRecordId: record.id,
				title,
				content,
				sizeBytes,
				editSummary: 'Page created',
				userId: user.id,
			})
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : ''
			if (message.includes('unique') || message.includes('duplicate')) {
				return fail(409, { error: 'A page with this title already exists', title, content })
			}
			return fail(500, { error: 'Failed to create page', title, content })
		}

		throw redirect(302, `/know/${slug}`)
	},
}
