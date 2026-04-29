import { error } from '@sveltejs/kit'
import { asc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { calendars, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { deleteContentEffects, updateContentEffects } from '$lib/server/content-effects.js'
import { urlSlugify } from '$lib/utils/slugify.js'
import type {
	createCalendarSchema,
	updateCalendarSchema,
} from '$lib/server/http/calendar/schemas.js'

type CreateCalendarInput = z.infer<typeof createCalendarSchema>
type UpdateCalendarInput = z.infer<typeof updateCalendarSchema>

export type Calendar = typeof calendars.$inferSelect

export async function listAllCalendars() {
	return db.select().from(calendars).orderBy(asc(calendars.name))
}

export async function findCalendarBySlugCaseInsensitive(slug: string) {
	const [cal] = await db.select().from(calendars).where(sql`LOWER(${calendars.slug}) = LOWER(${slug})`)
	return cal ?? null
}

export async function loadCalendarContent(contentRecordId: number | null) {
	if (!contentRecordId) {
		return { wikiContent: '', ast: null as unknown, contentRecordId: null as number | null }
	}
	const [record] = await db
		.select({ id: contentRecords.id, content: contentRecords.content, parsedAst: contentRecords.parsedAst })
		.from(contentRecords)
		.where(eq(contentRecords.id, contentRecordId))
	if (!record) return { wikiContent: '', ast: null, contentRecordId: null }
	return { wikiContent: record.content, ast: record.parsedAst, contentRecordId: record.id, rawContent: record.content }
}

export async function saveCalendarContent(input: {
	contentRecordId: number
	content: string
	editSummary: string
	userId: number
}) {
	const [existing] = await db
		.select()
		.from(contentRecords)
		.where(eq(contentRecords.id, input.contentRecordId))

	if (!existing) return { ok: false as const, status: 404, error: 'Content record not found' }

	const sizeBytes = new TextEncoder().encode(input.content).length
	const { plainText, ast } = await updateContentEffects(db, input.contentRecordId, input.content, 'calendar')

	await db
		.update(contentRecords)
		.set({ content: input.content, plainText, parsedAst: ast, sizeBytes, updatedAt: new Date() })
		.where(eq(contentRecords.id, input.contentRecordId))

	await db.insert(contentRevisions).values({
		contentRecordId: input.contentRecordId,
		title: existing.title,
		content: input.content,
		sizeBytes,
		editSummary: input.editSummary,
		userId: input.userId,
	})

	return { ok: true as const }
}

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
