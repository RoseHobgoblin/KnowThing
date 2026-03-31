import { json, error, isHttpError } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireEditorUser } from '$lib/server/auth.js'
import { moveKnowPage } from '$lib/server/services/content.js'

/** POST /api/pages/:slug/move — rename/move page */
export const POST: RequestHandler = async (event) => {
	const user = requireEditorUser(event)
	const { slug } = event.params
	const body = await event.request.json()
	const { newSlug, newTitle } = body as { newSlug: string, newTitle?: string }

	if (!newSlug?.trim()) {
		return json({ error: 'newSlug is required' }, { status: 400 })
	}

	const [existing] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!existing) throw error(404, 'Page not found')

	try {
		const updated = await moveKnowPage({
			slug,
			newSlug: newSlug.trim(),
			newTitle: newTitle?.trim() || existing.title,
			userId: user.id,
		})
		return json({ slug: updated.slug, title: updated.title })
	} catch (error_: unknown) {
		if (isHttpError(error_)) {
			return json({ error: error_.body?.message ?? error_.message }, { status: error_.status })
		}
		throw error_
	}
}
