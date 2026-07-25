import { error } from '@sveltejs/kit'
import { asc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { deleteContentByDomainSlug } from '$lib/server/services/content-records.js'
import {
	archiveEntity,
	mintOrAttachFacetEntity,
	repointCanonicalRoute,
	type EntitySpineDatabase,
} from '$lib/server/services/entity-spine.js'
import { mintEntitySlug, urlSlugify } from '$lib/utils/slugify.js'
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
	const trimmedName = name.trim()
	const slug = urlSlugify(trimmedName)

	const [existing] = await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.slug, slug))
	if (existing) throw error(409, 'A calendar with this name already exists')

	return db.transaction(async (tx) => {
		if (isPrimary) {
			await tx.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
		}

		const [cal] = await tx
			.insert(calendars)
			.values({
				name: trimmedName,
				slug,
				description: description?.trim() || '',
				isPrimary: isPrimary ?? false,
				staticData,
			})
			.returning()

		// Compatibility writer (0049): canonical know route in wiki style; the
		// hyphen slug lives on as a noncanonical alias.
		const { entityId } = await mintOrAttachFacetEntity(tx, {
			displayName: cal.name,
			namespace: 'know',
			legacySlugs: [cal.slug],
			hasFacet: id => hasCalendarFacet(tx, id),
		})
		const [attached] = await tx
			.update(calendars)
			.set({ entityId })
			.where(eq(calendars.id, cal.id))
			.returning()

		return { ...attached, slug }
	})
}

async function hasCalendarFacet(tx: EntitySpineDatabase, entityId: number): Promise<boolean> {
	const [row] = await tx
		.select({ id: calendars.id })
		.from(calendars)
		.where(eq(calendars.entityId, entityId))
		.limit(1)
	return !!row
}

export async function updateCalendar(id: number, data: UpdateCalendarInput) {
	const { name, description, isPrimary, planetId, staticData } = data

	return db.transaction(async (tx) => {
		if (isPrimary) {
			await tx.update(calendars).set({ isPrimary: false }).where(eq(calendars.isPrimary, true))
		}

		const [current] = await tx
			.select({ id: calendars.id, name: calendars.name, slug: calendars.slug, entityId: calendars.entityId })
			.from(calendars)
			.where(eq(calendars.id, id))
		if (!current) throw error(404, 'Calendar not found')

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

		// Rename → canonical route follows the name (old address 301s). The
		// stored hyphen slug never changes on update, so no new alias needed.
		if (updated.entityId != null && updated.name !== current.name) {
			await repointCanonicalRoute(tx, updated.entityId, {
				namespace: 'know',
				slug: mintEntitySlug('know', updated.name),
				displayName: updated.name,
			})
		}
		return updated
	})
}

export async function deleteCalendar(id: number) {
	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) throw error(404, 'Calendar not found')

	return db.transaction(async (tx) => {
		await deleteContentByDomainSlug(tx, 'calendar', cal.slug)
		await tx.delete(calendars).where(eq(calendars.id, id))
		// Archive, never hard-delete: routes keep resolving (banner, not 404).
		await archiveEntity(tx, cal.entityId)
		return { success: true }
	})
}
