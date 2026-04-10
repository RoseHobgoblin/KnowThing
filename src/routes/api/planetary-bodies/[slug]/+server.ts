import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { planetaryBodies, stars } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createPlanetaryBodySchema, updatePlanetaryBodySchema } from '$lib/celestial/schema.js'
import { parseBody } from '$lib/server/utils.js'
import { isDescendant } from '$lib/server/celestial/tree.js'
import { ensurePlanetaryBodyContentRecord } from '$lib/server/services/celestial-content.js'
import { deriveBodyOrbitalFields } from '$lib/celestial/compute.js'
import { applyNameUpdate, applyFieldUpdates, deleteCelestialEntity } from '$lib/server/celestial/update-helpers.js'

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

	if (result.length === 0) {
		return json({ error: 'Body not found' }, { status: 404 })
	}

	return json(result[0])
}

/** PUT /api/planetary-bodies/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updatePlanetaryBodySchema)
	if (data instanceof Response) return data

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

		const nextStarId = data.starId === undefined ? current.starId : data.starId
		if (nextStarId != null && parentBody.starId != null && parentBody.starId !== nextStarId) {
			return json({ error: 'Parent body belongs to a different star' }, { status: 400 })
		}
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) {
		await applyNameUpdate(setClause, data.name, current.slug, planetaryBodies, planetaryBodies.id, planetaryBodies.slug)
	}
	applyFieldUpdates(setClause, data as Record<string, unknown>,
		['pageSlug', 'temperature', 'age', 'composition', 'atmosphere',
			'surfacePressure', 'apparentMagnitude', 'angularDiameter', 'albedo'],
		['massKg', 'radiusM', 'orbitalPeriodDays', 'semiMajorAxisAu',
			'eccentricity', 'inclination', 'epochPhase', 'rotationPeriodS',
			'axialTilt', 'starId', 'parentId', 'satellites'],
	)
	if (data.bodyType !== undefined) setClause.bodyType = data.bodyType
	if (data.hasRings !== undefined) setClause.hasRings = data.hasRings ?? false
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''

	// Look up parent mass for Kepler derivation
	const finalMassKg = data.massKg === undefined ? current.massKg : data.massKg
	const finalStarId = data.starId === undefined ? current.starId : data.starId
	const finalParentId = data.parentId === undefined ? current.parentId : data.parentId
	let parentMassKg: number | null = null
	if (finalParentId != null) {
		const [parent] = await db.select({ massKg: planetaryBodies.massKg }).from(planetaryBodies).where(eq(planetaryBodies.id, finalParentId))
		parentMassKg = parent?.massKg ?? null
	}
	if (parentMassKg == null && finalStarId != null) {
		const [star] = await db.select({ massKg: stars.massKg }).from(stars).where(eq(stars.id, finalStarId))
		parentMassKg = star?.massKg ?? null
	}

	// Auto-compute orbital period from Kepler's third law when not provided
	const finalAu = data.semiMajorAxisAu === undefined ? current.semiMajorAxisAu : data.semiMajorAxisAu
	const finalOrbitalDays = data.orbitalPeriodDays === undefined ? current.orbitalPeriodDays : data.orbitalPeriodDays
	const orbital = deriveBodyOrbitalFields(finalAu, finalOrbitalDays, finalMassKg, parentMassKg)
	const effectivePeriodDays = finalOrbitalDays ?? orbital.orbitalPeriodDays
	if (data.orbitalPeriodDays === undefined && effectivePeriodDays != null && current.orbitalPeriodDays == null) {
		setClause.orbitalPeriodDays = effectivePeriodDays
	}

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
	return deleteCelestialEntity(planetaryBodies, planetaryBodies.slug, event.params.slug, 'Body')
}
