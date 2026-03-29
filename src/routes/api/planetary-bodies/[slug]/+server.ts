import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { planetaryBodies, stars } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { updatePlanetaryBodySchema } from '$lib/celestial/schema.js'
import { isDescendant } from '$lib/server/celestial/tree.js'

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
	const [current] = await db.select({ id: planetaryBodies.id }).from(planetaryBodies).where(eq(planetaryBodies.slug, event.params.slug))
	if (!current) return json({ error: 'Body not found' }, { status: 404 })

	// Circular reference prevention
	if (data.parentId != null && await isDescendant(current.id, data.parentId)) {
		return json({ error: 'Cannot set parent to self or a descendant' }, { status: 400 })
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) setClause.name = data.name.trim()
	if (data.bodyType !== undefined) setClause.bodyType = data.bodyType
	if (data.starId !== undefined) setClause.starId = data.starId ?? null
	if (data.parentId !== undefined) setClause.parentId = data.parentId ?? null
	if (data.pageSlug !== undefined) setClause.pageSlug = data.pageSlug?.trim() || null
	if (data.mass !== undefined) setClause.mass = data.mass?.trim() || null
	if (data.radius !== undefined) setClause.radius = data.radius?.trim() || null
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

	const [updated] = await db
		.update(planetaryBodies)
		.set(setClause)
		.where(eq(planetaryBodies.slug, event.params.slug))
		.returning()

	if (!updated) {
		return json({ error: 'Body not found' }, { status: 404 })
	}

	return json(updated)
}

/** DELETE /api/planetary-bodies/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const [deleted] = await db
		.delete(planetaryBodies)
		.where(eq(planetaryBodies.slug, event.params.slug))
		.returning()

	if (!deleted) {
		return json({ error: 'Body not found' }, { status: 404 })
	}

	return json({ success: true })
}
