import { error } from '@sveltejs/kit'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { planetaryBodies, stars } from '$lib/server/db/schema.js'
import {
	createPlanetaryBodySchema,
	legacySafeEccentricity,
	type updatePlanetaryBodySchema,
} from '$lib/celestial/schema.js'
import { deriveBodyOrbitalFields } from '$lib/celestial/compute.js'
import { isDescendant } from '$lib/server/celestial/tree.js'
import {
	applyFieldUpdates,
	applyNameUpdate,
	deleteCelestialEntity,
	mergeOverrideExtras,
	BODY_OVERRIDE_MAP,
} from '$lib/server/celestial/update-helpers.js'
type CreateBodyInput = z.infer<typeof createPlanetaryBodySchema>
type UpdateBodyInput = z.infer<typeof updatePlanetaryBodySchema>

export async function listBodies(starSlug: string | null) {
	let query = sql`
		SELECT
			pb.*,
			s.name AS "starName",
			s.slug AS "starSlug",
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		LEFT JOIN stars s ON s.id = pb.star_id
	`
	if (starSlug) query = sql`${query} WHERE s.slug = ${starSlug}`
	query = sql`${query} ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name`
	return db.execute(query)
}

export async function getBodyBySlug(slug: string) {
	const result = await db.execute(sql`
		SELECT
			pb.*,
			s.name AS "starName",
			s.slug AS "starSlug",
			p.name AS "parentName",
			p.slug AS "parentSlug",
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		LEFT JOIN stars s ON s.id = pb.star_id
		LEFT JOIN planetary_bodies p ON p.id = pb.parent_id
		WHERE pb.slug = ${slug}
	`)
	if (result.length === 0) throw error(404, 'Body not found')
	return result[0]
}

async function assertSlugAvailable(slug: string) {
	const [existing] = await db.select({ id: planetaryBodies.id }).from(planetaryBodies).where(eq(planetaryBodies.slug, slug))
	if (existing) throw error(409, 'A body with this slug already exists')
}

async function assertStarExists(starId: number) {
	const [star] = await db.select({ id: stars.id }).from(stars).where(eq(stars.id, starId))
	if (!star) throw error(400, 'Parent star not found')
}

async function loadParentBody(parentId: number) {
	const [parent] = await db
		.select({ id: planetaryBodies.id, starId: planetaryBodies.starId })
		.from(planetaryBodies)
		.where(eq(planetaryBodies.id, parentId))
	if (!parent) throw error(400, 'Parent body not found')
	return parent
}

async function resolveParentMass(parentId: number | null, starId: number | null): Promise<number | null> {
	if (parentId != null) {
		const [parent] = await db.select({ massKg: planetaryBodies.massKg }).from(planetaryBodies).where(eq(planetaryBodies.id, parentId))
		if (parent?.massKg != null) return parent.massKg
	}
	if (starId != null) {
		const [star] = await db.select({ massKg: stars.massKg }).from(stars).where(eq(stars.id, starId))
		return star?.massKg ?? null
	}
	return null
}

export async function createBody(data: CreateBodyInput) {
	await assertSlugAvailable(data.slug.trim().toLowerCase())

	if (data.starId != null) await assertStarExists(data.starId)

	if (data.parentId != null) {
		const parent = await loadParentBody(data.parentId)
		if (data.starId != null && parent.starId != null && parent.starId !== data.starId) {
			throw error(400, 'Parent body belongs to a different star')
		}
	}

	const parentMassKg = await resolveParentMass(data.parentId ?? null, data.starId ?? null)
	const orbital = deriveBodyOrbitalFields(data.semiMajorAxisAu ?? null, data.orbitalPeriodDays ?? null, data.massKg ?? null, parentMassKg, data.eccentricity ?? null)
	const effectivePeriodDays = data.orbitalPeriodDays ?? orbital.orbitalPeriodDays

	return db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(planetaryBodies)
			.values({
				name: data.name.trim(),
				slug: data.slug.trim().toLowerCase(),
				bodyType: data.bodyType,
				starId: data.starId ?? null,
				parentId: data.parentId ?? null,
				pageSlug: data.pageSlug?.trim() || null,
				massKg: data.massKg ?? null,
				radiusM: data.radiusM ?? null,
				temperature: data.temperature?.trim() || null,
				age: data.age?.trim() || null,
				composition: data.composition?.trim() || null,
				atmosphere: data.atmosphere?.trim() || null,
				surfacePressure: data.surfacePressure?.trim() || null,
				orbitalPeriodDays: effectivePeriodDays,
				semiMajorAxisAu: data.semiMajorAxisAu ?? null,
				eccentricity: data.eccentricity ?? null,
				inclination: data.inclination ?? null,
				epochPhase: data.epochPhase ?? null,
				rotationPeriodS: data.rotationPeriodS ?? null,
				axialTilt: data.axialTilt ?? null,
				apparentMagnitude: data.apparentMagnitude?.trim() || null,
				angularDiameter: data.angularDiameter?.trim() || null,
				albedo: data.albedo?.trim() || null,
				satellites: data.satellites ?? null,
				hasRings: data.hasRings ?? false,
				extra: mergeOverrideExtras(data.extra, data as Record<string, unknown>, BODY_OVERRIDE_MAP),
				description: data.description?.trim() || '',
			})
			.returning()

		const [updated] = await tx.select().from(planetaryBodies).where(eq(planetaryBodies.id, inserted.id))
		return updated ?? inserted
	})
}

export async function updateBody(slug: string, data: UpdateBodyInput) {
	const [current] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, slug))
	if (!current) throw error(404, 'Body not found')

	const merged = createPlanetaryBodySchema.safeParse({
		...current,
		eccentricity: legacySafeEccentricity(current.eccentricity),
		...data,
	})
	if (!merged.success) throw error(400, merged.error.issues[0].message)

	if (data.parentId != null && await isDescendant(current.id, data.parentId)) {
		throw error(400, 'Cannot set parent to self or a descendant')
	}

	if (data.starId != null) await assertStarExists(data.starId)

	if (data.parentId != null) {
		const parent = await loadParentBody(data.parentId)
		const nextStarId = data.starId === undefined ? current.starId : data.starId
		if (nextStarId != null && parent.starId != null && parent.starId !== nextStarId) {
			throw error(400, 'Parent body belongs to a different star')
		}
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) {
		await applyNameUpdate(setClause, data.name, current.slug, planetaryBodies, planetaryBodies.id, planetaryBodies.slug)
	}
	applyFieldUpdates(
		setClause,
		data as Record<string, unknown>,
		['pageSlug', 'temperature', 'age', 'composition', 'atmosphere',
			'surfacePressure', 'apparentMagnitude', 'angularDiameter', 'albedo'],
		// orbitalPeriodDays is handled explicitly below so an "auto" (null) value
		// persists the Kepler-derived period instead of nulling the column.
		['massKg', 'radiusM', 'semiMajorAxisAu',
			'eccentricity', 'inclination', 'epochPhase', 'rotationPeriodS',
			'axialTilt', 'starId', 'parentId', 'satellites'],
	)
	if (data.bodyType !== undefined) setClause.bodyType = data.bodyType
	if (data.hasRings !== undefined) setClause.hasRings = data.hasRings ?? false
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''

	// Route "lock to override" fields into the extra overflow, preserving other keys.
	setClause.extra = mergeOverrideExtras(setClause.extra ?? current.extra, data as Record<string, unknown>, BODY_OVERRIDE_MAP)

	const finalMassKg = data.massKg === undefined ? current.massKg : data.massKg
	const finalStarId = data.starId === undefined ? current.starId : data.starId
	const finalParentId = data.parentId === undefined ? current.parentId : data.parentId
	const parentMassKg = await resolveParentMass(finalParentId, finalStarId)

	const finalAu = data.semiMajorAxisAu === undefined ? current.semiMajorAxisAu : data.semiMajorAxisAu
	const finalOrbitalDays = data.orbitalPeriodDays === undefined ? current.orbitalPeriodDays : data.orbitalPeriodDays
	const finalEccentricity = data.eccentricity === undefined ? current.eccentricity : data.eccentricity
	const orbital = deriveBodyOrbitalFields(finalAu, finalOrbitalDays, finalMassKg, parentMassKg, finalEccentricity)
	const effectivePeriodDays = finalOrbitalDays ?? orbital.orbitalPeriodDays
	if (data.orbitalPeriodDays !== undefined) {
		// Explicit custom period, or null ("auto") → persist the Kepler-derived value
		// so the map animation and infobox velocity have a concrete period to work from.
		setClause.orbitalPeriodDays = data.orbitalPeriodDays ?? orbital.orbitalPeriodDays ?? null
	} else if (effectivePeriodDays != null && current.orbitalPeriodDays == null) {
		// Field untouched, but a period can now be derived (e.g. mass was just added).
		setClause.orbitalPeriodDays = effectivePeriodDays
	}

	if (data.satellites === undefined) {
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(planetaryBodies)
			.where(eq(planetaryBodies.parentId, current.id))
		setClause.satellites = count
	}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx.update(planetaryBodies).set(setClause).where(eq(planetaryBodies.slug, slug)).returning()
		if (!saved) return null

		const [refetched] = await tx.select().from(planetaryBodies).where(eq(planetaryBodies.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) throw error(404, 'Body not found')
	return updated
}

export async function deleteBody(slug: string) {
	return deleteCelestialEntity(planetaryBodies, planetaryBodies.slug, slug, 'Body')
}
