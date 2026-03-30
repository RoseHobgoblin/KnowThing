import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars, contentRecords } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { staticDataSchema } from '$lib/calendar/schema.js'
import { urlSlugify } from '$lib/utils/slugify.js'

const createCalendarSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	description: z.string().optional(),
	isPrimary: z.boolean().optional(),
	staticData: staticDataSchema,
})

/** GET /api/calendar — get primary calendar */
export const GET: RequestHandler = async () => {
	const [cal] = await db
		.select()
		.from(calendars)
		.where(eq(calendars.isPrimary, true))
		.limit(1)

	if (!cal) {
		return json({ error: 'No primary calendar configured' }, { status: 404 })
	}

	return json(cal)
}

/** POST /api/calendar — create a calendar */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const body = await event.request.json()
	const parsed = createCalendarSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const { name, description, isPrimary, staticData } = parsed.data
	const slug = urlSlugify(name)

	// Check slug uniqueness
	const [existing] = await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.slug, slug))
	if (existing) {
		return json({ error: 'A calendar with this name already exists' }, { status: 409 })
	}

	// If this is set as primary, unset other primaries
	if (isPrimary) {
		await db.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
	}

	// Create content record
	const [contentRecord] = await db
		.insert(contentRecords)
		.values({ domain: 'calendar', slug, title: name.trim(), content: '', plainText: '', sizeBytes: 0 })
		.returning()

	const [cal] = await db
		.insert(calendars)
		.values({
			name: name.trim(),
			slug,
			description: description?.trim() || '',
			isPrimary: isPrimary ?? false,
			staticData,
			contentRecordId: contentRecord.id,
		})
		.returning()

	return json({ ...cal, slug }, { status: 201 })
}
