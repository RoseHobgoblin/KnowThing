import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { desc, eq } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'
import { createKnowPage } from '$lib/server/services/content.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'

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
	const data = createPageSchema.safeParse(body)
	if (!data.success) {
		return json({ error: data.error.issues[0].message }, { status: 400 })
	}
	const { title, content } = data.data

	return handleServiceCall(async () => {
		const record = await createKnowPage({
			title,
			content: content || '',
			slug: (body as Record<string, unknown>).slug as string | undefined,
			userId: user.id,
		})
		return json(record, { status: 201 })
	})
}
