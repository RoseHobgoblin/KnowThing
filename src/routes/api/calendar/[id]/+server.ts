import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { requireAdminUser } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { staticDataSchema } from '$lib/calendar/schema.js'

const updateCalendarSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	isPrimary: z.boolean().optional(),
	planetId: z.number().int().nullable().optional(),
	staticData: staticDataSchema.optional(),
})

/** GET /api/calendar/:id */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number.parseInt(params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) return json({ error: 'Calendar not found' }, { status: 404 })

	return json(cal)
}

/** PUT /api/calendar/:id — update calendar config */
export const PUT: RequestHandler = async (event) => {
	requireAdminUser(event)

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const parsed = updateCalendarSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const { name, description, isPrimary, planetId, staticData } = parsed.data

	// If setting as primary, unset others
	if (isPrimary) {
		await db.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
	}

	const [updated] = await db
		.update(calendars)
		.set({
			...(name && { name: name.trim() }),
			...(description !== undefined && { description: description?.trim() || '' }),
			...(isPrimary !== undefined && { isPrimary }),
			...(planetId !== undefined && { planetId }),
			...(staticData && { staticData }),
		})
		.where(eq(calendars.id, id))
		.returning()

	if (!updated) return json({ error: 'Calendar not found' }, { status: 404 })
	return json(updated)
}

/** DELETE /api/calendar/:id */
export const DELETE: RequestHandler = async (event) => {
	requireAdminUser(event)

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	// Load calendar to get content record ID
	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) return json({ error: 'Calendar not found' }, { status: 404 })

	// Clean up content record
	if (cal.contentRecordId) {
		const { deleteContentEffects } = await import('$lib/server/content-effects.js')
		await deleteContentEffects(cal.contentRecordId)
		const { contentRecords } = await import('$lib/server/db/schema.js')
		await db.delete(contentRecords).where(eq(contentRecords.id, cal.contentRecordId))
	}

	await db.delete(calendars).where(eq(calendars.id, id))
	return json({ success: true })
}
