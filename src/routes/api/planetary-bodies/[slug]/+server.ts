import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { planetaryBodies, stars } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createPlanetaryBodySchema, updatePlanetaryBodySchema } from '$lib/celestial/schema.js'
import { isDescendant } from '$lib/server/celestial/tree.js'
import {
	deleteCelestialContentRecord,
	ensurePlanetaryBodyContentRecord,
} from '$lib/server/services/celestial-content.js'
import { deriveBodyFields, deriveDisplayStrings } from '$lib/celestial/compute.js'

/** GET /api/planetary-bodies/:slug */
export const GET: RequestHandler = async ({ params }) => {
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
		WHERE pb.slug = ${params.slug}
	`)

	if (!result.length) {
		return json({ error: 'Body not found' }, { status: 404 })
	}

	return json(result[0])
}

/** PUT /api/planetary-bodies/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const body = await event.request.json()
	const parsed = updatePlanetaryBodySchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const data = parsed.data

	// Get current body for circular ref check
	const [current] = await db
		.select()
		.from(planetaryBodies)
		.where(eq(planetaryBodies.slug, event.params.slug))
	if (!current) return json({ error: 'Body not found' }, { status: 404 })

	const merged = createPlanetaryBodySchema.safeParse({ ...current, ...data })
	if (!merged.success) {
		return json({ error: merged.error.issues[0].message }, { status: 400 })
	}

	// Circular reference prevention
	if (data.parentId != null && await isDescendant(current.id, data.parentId)) {
		return json({ error: 'Cannot set parent to self or a descendant' }, { status: 400 })
	}

	if (data.starId != null) {
		const [star] = await db.select({ id: stars.id }).from(stars).where(eq(stars.id, data.starId))
		if (!star) {
			return json({ error: 'Parent star not found' }, { status: 400 })
		}
	}

	if (data.parentId != null) {
		const [parentBody] = await db
			.select({ id: planetaryBodies.id, starId: planetaryBodies.starId })
			.from(planetaryBodies)
			.where(eq(planetaryBodies.id, data.parentId))

		if (!parentBody) {
			return json({ error: 'Parent body not found' }, { status: 400 })
		}

		const nextStarId = data.starId !== undefined ? data.starId : current.starId
		if (nextStarId != null && parentBody.starId != null && parentBody.starId !== nextStarId) {
			return json({ error: 'Parent body belongs to a different star' }, { status: 400 })
		}
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) setClause.name = data.name.trim()
	if (data.bodyType !== undefined) setClause.bodyType = data.bodyType
	if (data.starId !== undefined) setClause.starId = data.starId ?? null
	if (data.parentId !== undefined) setClause.parentId = data.parentId ?? null
	if (data.pageSlug !== undefined) setClause.pageSlug = data.pageSlug?.trim() || null
	if (data.mass !== undefined) setClause.mass = data.mass?.trim() || null
	if (data.massKg !== undefined) setClause.massKg = data.massKg ?? null
	if (data.radius !== undefined) setClause.radius = data.radius?.trim() || null
	if (data.radiusM !== undefined) setClause.radiusM = data.radiusM ?? null
	if (data.density !== undefined) setClause.density = data.density?.trim() || null
	if (data.surfaceGravity !== undefined) setClause.surfaceGravity = data.surfaceGravity?.trim() || null
	if (data.escapeVelocity !== undefined) setClause.escapeVelocity = data.escapeVelocity?.trim() || null
	if (data.temperature !== undefined) setClause.temperature = data.temperature?.trim() || null
	if (data.age !== undefined) setClause.age = data.age?.trim() || null
	if (data.composition !== undefined) setClause.composition = data.composition?.trim() || null
	if (data.atmosphere !== undefined) setClause.atmosphere = data.atmosphere?.trim() || null
	if (data.surfacePressure !== undefined) setClause.surfacePressure = data.surfacePressure?.trim() || null
	if (data.orbitalPeriod !== undefined) setClause.orbitalPeriod = data.orbitalPeriod?.trim() || null
	if (data.orbitalPeriodDays !== undefined) setClause.orbitalPeriodDays = data.orbitalPeriodDays ?? null
	if (data.semiMajorAxis !== undefined) setClause.semiMajorAxis = data.semiMajorAxis?.trim() || null
	if (data.semiMajorAxisAu !== undefined) setClause.semiMajorAxisAu = data.semiMajorAxisAu ?? null
	if (data.eccentricity !== undefined) setClause.eccentricity = data.eccentricity ?? null
	if (data.inclination !== undefined) setClause.inclination = data.inclination ?? null
	if (data.epochPhase !== undefined) setClause.epochPhase = data.epochPhase ?? null
	if (data.rotationPeriod !== undefined) setClause.rotationPeriod = data.rotationPeriod?.trim() || null
	if (data.rotationPeriodS !== undefined) setClause.rotationPeriodS = data.rotationPeriodS ?? null
	if (data.axialTilt !== undefined) setClause.axialTilt = data.axialTilt ?? null
	if (data.apparentMagnitude !== undefined) setClause.apparentMagnitude = data.apparentMagnitude?.trim() || null
	if (data.angularDiameter !== undefined) setClause.angularDiameter = data.angularDiameter?.trim() || null
	if (data.albedo !== undefined) setClause.albedo = data.albedo?.trim() || null
	if (data.satellites !== undefined) setClause.satellites = data.satellites ?? null
	if (data.hasRings !== undefined) setClause.hasRings = data.hasRings ?? false
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''

	// Auto-compute derived physical properties from numeric mass/radius
	const finalMassKg = data.massKg !== undefined ? data.massKg : current.massKg
	const finalRadiusM = data.radiusM !== undefined ? data.radiusM : current.radiusM
	const derived = deriveBodyFields(finalMassKg, finalRadiusM)
	// Only overwrite if not explicitly locked (user didn't send their own value)
	if (data.density === undefined && derived.density) setClause.density = derived.density
	if (data.surfaceGravity === undefined && derived.surfaceGravity) setClause.surfaceGravity = derived.surfaceGravity
	if (data.escapeVelocity === undefined && derived.escapeVelocity) setClause.escapeVelocity = derived.escapeVelocity

	// Auto-format display strings from numeric values
	const finalOrbitalDays = data.orbitalPeriodDays !== undefined ? data.orbitalPeriodDays : current.orbitalPeriodDays
	const finalAu = data.semiMajorAxisAu !== undefined ? data.semiMajorAxisAu : current.semiMajorAxisAu
	const finalRotS = data.rotationPeriodS !== undefined ? data.rotationPeriodS : current.rotationPeriodS
	const display = deriveDisplayStrings(finalOrbitalDays, finalAu, finalRotS)
	if (data.orbitalPeriod === undefined && display.orbitalPeriod) setClause.orbitalPeriod = display.orbitalPeriod
	if (data.semiMajorAxis === undefined && display.semiMajorAxis) setClause.semiMajorAxis = display.semiMajorAxis
	if (data.rotationPeriod === undefined && display.rotationPeriod) setClause.rotationPeriod = display.rotationPeriod

	// Auto-compute satellite count from child records
	if (data.satellites === undefined) {
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(planetaryBodies)
			.where(eq(planetaryBodies.parentId, current.id))
		setClause.satellites = count
	}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx
			.update(planetaryBodies)
			.set(setClause)
			.where(eq(planetaryBodies.slug, event.params.slug))
			.returning()

		if (!saved) return null

		await ensurePlanetaryBodyContentRecord(tx, saved)

		const [refetched] = await tx.select().from(planetaryBodies).where(eq(planetaryBodies.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) {
		return json({ error: 'Body not found' }, { status: 404 })
	}

	return json(updated)
}

/** DELETE /api/planetary-bodies/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const deleted = await db.transaction(async (tx) => {
		const [removed] = await tx
			.delete(planetaryBodies)
			.where(eq(planetaryBodies.slug, event.params.slug))
			.returning()

		if (!removed) return null

		await deleteCelestialContentRecord(tx, removed.contentRecordId)
		return removed
	})

	if (!deleted) {
		return json({ error: 'Body not found' }, { status: 404 })
	}

	return json({ success: true })
}
