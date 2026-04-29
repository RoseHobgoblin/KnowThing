import { error } from '@sveltejs/kit'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { stars, starSystems } from '$lib/server/db/schema.js'
import { createStarSchema, type updateStarSchema } from '$lib/celestial/schema.js'
import { computeLuminosity, computeOrbitalPeriodDays } from '$lib/celestial/compute.js'
import {
	deleteCelestialEntity,
	applyFieldUpdates,
	applyNameUpdate,
} from '$lib/server/celestial/update-helpers.js'
import { ensureStarContentRecord, syncBodiesForStar } from '$lib/server/services/celestial-content.js'

type CreateStarInput = z.infer<typeof createStarSchema>
type UpdateStarInput = z.infer<typeof updateStarSchema>

function assertMergedStarValid(current: typeof stars.$inferSelect, patch: UpdateStarInput) {
	const merged = createStarSchema.safeParse({ ...current, ...patch })
	if (!merged.success) {
		throw error(400, merged.error.issues[0].message)
	}
}

export async function listStars() {
	return db.execute(sql`
		SELECT
			s.*,
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		ORDER BY s.name
	`)
}

export async function getStarBySlug(slug: string) {
	const result = await db.execute(sql`
		SELECT
			s.*,
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		WHERE s.slug = ${slug}
	`)
	if (!result.length) throw error(404, 'Star not found')
	return result[0]
}

async function assertSystemExists(systemId: number) {
	const [system] = await db.select({ id: starSystems.id }).from(starSystems).where(eq(starSystems.id, systemId))
	if (!system) throw error(400, 'Star system not found')
}

async function assertParentStarExists(parentStarId: number) {
	const [parent] = await db.select({ id: stars.id }).from(stars).where(eq(stars.id, parentStarId))
	if (!parent) throw error(400, 'Parent star not found')
}

async function assertSlugAvailable(slug: string) {
	const [existing] = await db.select({ id: stars.id }).from(stars).where(eq(stars.slug, slug))
	if (existing) throw error(409, 'A star with this slug already exists')
}

export async function createStar(data: CreateStarInput) {
	if (data.systemId != null) await assertSystemExists(data.systemId)
	if (data.parentStarId != null) await assertParentStarExists(data.parentStarId)
	await assertSlugAvailable(data.slug.trim().toLowerCase())

	let derivedLuminosityW = data.luminosityW ?? null
	if (
		derivedLuminosityW == null
		&& data.radiusM != null
		&& data.temperatureK != null
		&& data.radiusM > 0
		&& data.temperatureK > 0
	) {
		derivedLuminosityW = computeLuminosity(data.radiusM, data.temperatureK)
	}

	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(stars)
			.values({
				name: data.name.trim(),
				slug: data.slug.trim().toLowerCase(),
				pageSlug: data.pageSlug?.trim() || null,
				spectralType: data.spectralType?.trim() || null,
				massKg: data.massKg ?? null,
				radiusM: data.radiusM ?? null,
				luminosityW: derivedLuminosityW,
				luminosityVisual: data.luminosityVisual?.trim() || null,
				temperatureK: data.temperatureK ?? null,
				age: data.age?.trim() || null,
				color: data.color?.trim() || null,
				rotationPeriodS: data.rotationPeriodS ?? null,
				axialTilt: data.axialTilt ?? null,
				orbitalPeriodDays: data.orbitalPeriodDays ?? null,
				semiMajorAxisAu: data.semiMajorAxisAu ?? null,
				eccentricity: data.eccentricity ?? null,
				apparentMagnitude: data.apparentMagnitude?.trim() || null,
				absoluteMagnitude: data.absoluteMagnitude?.trim() || null,
				angularDiameter: data.angularDiameter?.trim() || null,
				metallicity: data.metallicity?.trim() || null,
				companion: data.companion?.trim() || null,
				parentStarId: data.parentStarId ?? null,
				systemId: data.systemId ?? null,
				epochPhase: data.epochPhase ?? null,
				extra: data.extra ?? {},
				description: data.description?.trim() || '',
			})
			.returning()

		await ensureStarContentRecord(tx, created)

		const [updated] = await tx.select().from(stars).where(eq(stars.id, created.id))
		return updated ?? created
	})
}

export async function updateStar(slug: string, data: UpdateStarInput) {
	const [current] = await db.select().from(stars).where(eq(stars.slug, slug))
	if (!current) throw error(404, 'Star not found')

	assertMergedStarValid(current, data)

	if (data.systemId != null) await assertSystemExists(data.systemId)

	if (data.parentStarId != null) {
		if (data.parentStarId === current.id) throw error(400, 'A star cannot orbit itself')
		await assertParentStarExists(data.parentStarId)
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) {
		await applyNameUpdate(setClause, data.name, current.slug, stars, stars.id, stars.slug)
	}
	applyFieldUpdates(
		setClause,
		data as Record<string, unknown>,
		['pageSlug', 'spectralType', 'luminosityVisual', 'age', 'color',
			'apparentMagnitude', 'absoluteMagnitude', 'angularDiameter',
			'metallicity', 'companion'],
		['massKg', 'radiusM', 'luminosityW', 'temperatureK',
			'rotationPeriodS', 'axialTilt', 'orbitalPeriodDays', 'semiMajorAxisAu',
			'eccentricity', 'parentStarId', 'systemId', 'epochPhase'],
	)
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''

	const finalRadiusM = data.radiusM !== undefined ? data.radiusM : current.radiusM
	const finalTempK = data.temperatureK !== undefined ? data.temperatureK : current.temperatureK
	if (data.luminosityW === undefined && finalRadiusM != null && finalTempK != null && finalRadiusM > 0 && finalTempK > 0) {
		setClause.luminosityW = computeLuminosity(finalRadiusM, finalTempK)
	}

	const finalMassKg = data.massKg !== undefined ? data.massKg : current.massKg
	const finalAu = data.semiMajorAxisAu !== undefined ? data.semiMajorAxisAu : current.semiMajorAxisAu
	const finalOrbitalDays = data.orbitalPeriodDays !== undefined ? data.orbitalPeriodDays : current.orbitalPeriodDays
	if (finalOrbitalDays == null && finalAu != null && finalAu > 0 && current.parentStarId != null) {
		const [parentStar] = await db.select({ massKg: stars.massKg }).from(stars).where(eq(stars.id, current.parentStarId))
		if (parentStar?.massKg) {
			const totalMass = (finalMassKg ?? 0) + parentStar.massKg
			if (totalMass > 0) {
				setClause.orbitalPeriodDays = computeOrbitalPeriodDays(finalAu, totalMass)
			}
		}
	}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx.update(stars).set(setClause).where(eq(stars.slug, slug)).returning()
		if (!saved) return null

		await ensureStarContentRecord(tx, saved)
		await syncBodiesForStar(tx, saved.id)

		const [refetched] = await tx.select().from(stars).where(eq(stars.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) throw error(404, 'Star not found')
	return updated
}

export async function deleteStar(slug: string) {
	return deleteCelestialEntity(stars, stars.slug, slug, 'Star')
}
