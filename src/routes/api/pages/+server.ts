import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { desc, eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/auth.js'
import { updateContentEffects } from '$lib/server/content-effects.js'
import { slugify } from '$lib/renderer/context.js'

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
	const user = requireAuth(event)
	const body = await event.request.json()
	const parsed = createPageSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}
	const { title, content } = parsed.data

	const slug = (body as Record<string, unknown>).slug as string || slugify(title)
	const sizeBytes = new TextEncoder().encode(content || '').length

	const [record] = await db
		.insert(contentRecords)
		.values({ domain: 'know', slug, title: title.trim(), content: content || '', plainText: '', sizeBytes })
		.returning()

	const { plainText, ast } = await updateContentEffects(record.id, content || '')

	await db
		.update(contentRecords)
		.set({ plainText, parsedAst: ast })
		.where(eq(contentRecords.id, record.id))

	await db.insert(contentRevisions).values({
		contentRecordId: record.id,
		title: record.title,
		content: record.content,
		sizeBytes,
		editSummary: 'Page created',
		userId: user.id,
	})

	return json(record, { status: 201 })
}
