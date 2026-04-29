import { error } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { calendars, contentRecords } from '$lib/server/db/schema.js'
import { deleteContentEffects } from '$lib/server/content-effects.js'
import { urlSlugify } from '$lib/utils/slugify.js'
import type {
	createCalendarSchema,
	updateCalendarSchema,
} from '$lib/server/http/calendar/schemas.js'

type CreateCalendarInput = z.infer<typeof createCalendarSchema>
type UpdateCalendarInput = z.infer<typeof updateCalendarSchema>

export async function listCalendars() {
	return db
		.select({
			id: calendars.id,
			name: calendars.name,
			description: calendars.description,
			isPrimary: calendars.isPrimary,
		})
		.from(calendars)
		.orderBy(asc(calendars.name))
}

export async function getPrimaryCalendar() {
	const [cal] = await db
		.select()
		.from(calendars)
		.where(eq(calendars.isPrimary, true))
		.limit(1)
	if (!cal) throw error(404, 'No primary calendar configured')
	return cal
}

export async function getCalendarById(id: number) {
	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) throw error(404, 'Calendar not found')
	return cal
}

export async function createCalendar(data: CreateCalendarInput) {
	const { name, description, isPrimary, staticData } = data
	const slug = urlSlugify(name)

	const [existing] = await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.slug, slug))
	if (existing) throw error(409, 'A calendar with this name already exists')

	return db.transaction(async (tx) => {
		if (isPrimary) {
			await tx.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
		}

		const [contentRecord] = await tx
			.insert(contentRecords)
			.values({ domain: 'calendar', slug, title: name.trim(), content: '', plainText: '', sizeBytes: 0 })
			.returning()

		const [cal] = await tx
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

		return { ...cal, slug }
	})
}

export async function updateCalendar(id: number, data: UpdateCalendarInput) {
	const { name, description, isPrimary, planetId, staticData } = data

	return db.transaction(async (tx) => {
		if (isPrimary) {
			await tx.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
		}

		const [updated] = await tx
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

		if (!updated) throw error(404, 'Calendar not found')
		return updated
	})
}

export async function deleteCalendar(id: number) {
	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) throw error(404, 'Calendar not found')

	if (cal.contentRecordId) {
		await deleteContentEffects(cal.contentRecordId)
		await db.delete(contentRecords).where(eq(contentRecords.id, cal.contentRecordId))
	}
	await db.delete(calendars).where(eq(calendars.id, id))
	return { success: true }
}
