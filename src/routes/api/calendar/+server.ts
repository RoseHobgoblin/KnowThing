import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { staticDataSchema } from '$lib/calendar/schema.js'

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
	const user = requireAuth(event)
	if (user.role !== 'admin') {
		return json({ error: 'Admin access required' }, { status: 403 })
	}

	const body = await event.request.json()
	const parsed = createCalendarSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const { name, description, isPrimary, staticData } = parsed.data

	// If this is set as primary, unset other primaries
	if (isPrimary) {
		await db.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
	}

	const [cal] = await db
		.insert(calendars)
		.values({
			name: name.trim(),
			description: description?.trim() || '',
			isPrimary: isPrimary ?? false,
			staticData,
			calendarDate: {}, // deprecated, ignored
		})
		.returning()

	return json(cal, { status: 201 })
}
