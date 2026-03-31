import { isHttpError, json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { desc, eq } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'
import { createKnowPage } from '$lib/server/services/content.js'

const createPageSchema = z.object({
	title: z.string().min(1, 'Title is required'),
	content: z.string(),
})

/** GET /api/pages — list all pages */
export const GET: RequestHandler = async () => {
	const result = await db
		.select({
			slug: contentRecords.slug,
			title: contentRecords.title,
			sizeBytes: contentRecords.sizeBytes,
			updatedAt: contentRecords.updatedAt,
		})
		.from(contentRecords)
		.where(eq(contentRecords.domain, 'know'))
		.orderBy(desc(contentRecords.updatedAt))

	return json(result)
}

/** POST /api/pages — create a new page */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const body = await event.request.json()
	const parsed = createPageSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}
	const { title, content } = parsed.data

	try {
		const record = await createKnowPage({
			title,
			content: content || '',
			slug: (body as Record<string, unknown>).slug as string | undefined,
			userId: user.id,
		})
		return json(record, { status: 201 })
	} catch (error: unknown) {
		if (isHttpError(error)) {
			return json({ error: error.body?.message ?? error.message }, { status: error.status })
		}
		throw error
	}
}
