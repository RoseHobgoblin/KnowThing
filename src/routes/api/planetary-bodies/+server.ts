import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { planetaryBodies, stars } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createPlanetaryBodySchema } from '$lib/celestial/schema.js'
import { ensurePlanetaryBodyContentRecord } from '$lib/server/services/celestial-content.js'
import { deriveBodyFields, deriveBodyOrbitalFields, deriveDisplayStrings } from '$lib/celestial/compute.js'

/** GET /api/planetary-bodies?star=slug — list bodies, optionally filtered by star */
export const GET: RequestHandler = async ({ url }) => {
	const starSlug = url.searchParams.get('star')

	let query = sql`
		SELECT
			pb.*,
			s.name AS "starName",
			s.slug AS "starSlug",
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		LEFT JOIN stars s ON s.id = pb.star_id
	`

	if (starSlug) {
		query = sql`${query} WHERE s.slug = ${starSlug}`
	}

	query = sql`${query} ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name`

	const result = await db.execute(query)
	return json(result)
}

/** POST /api/planetary-bodies — create a body */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const body = await event.request.json()
	const parsed = createPlanetaryBodySchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const data = parsed.data

	// Check slug uniqueness
	const [existing] = await db.select({ id: planetaryBodies.id }).from(planetaryBodies).where(eq(planetaryBodies.slug, data.slug))
	if (existing) {
		return json({ error: 'A body with this slug already exists' }, { status: 409 })
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

		if (data.starId != null && parentBody.starId != null && parentBody.starId !== data.starId) {
			return json({ error: 'Parent body belongs to a different star' }, { status: 400 })
		}
	}

	// Look up parent mass for Kepler derivation
	let parentMassKg: number | null = null
	if (data.parentId != null) {
		const [parent] = await db.select({ massKg: planetaryBodies.massKg }).from(planetaryBodies).where(eq(planetaryBodies.id, data.parentId))
		parentMassKg = parent?.massKg ?? null
	}
	if (parentMassKg == null && data.starId != null) {
		const [star] = await db.select({ massKg: stars.massKg }).from(stars).where(eq(stars.id, data.starId))
		parentMassKg = star?.massKg ?? null
	}

	// Auto-compute derived fields
	const derived = deriveBodyFields(data.massKg ?? null, data.radiusM ?? null)
	const orbital = deriveBodyOrbitalFields(data.semiMajorAxisAu ?? null, data.orbitalPeriodDays ?? null, data.massKg ?? null, parentMassKg)
	const effectivePeriodDays = data.orbitalPeriodDays ?? orbital.orbitalPeriodDays
	const display = deriveDisplayStrings(effectivePeriodDays, data.semiMajorAxisAu ?? null, data.rotationPeriodS ?? null)

	const created = await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(planetaryBodies)
			.values({
				name: data.name.trim(),
				slug: data.slug.trim().toLowerCase(),
				bodyType: data.bodyType,
				starId: data.starId ?? null,
				parentId: data.parentId ?? null,
				pageSlug: data.pageSlug?.trim() || null,
				mass: data.mass?.trim() || null,
				massKg: data.massKg ?? null,
				radius: data.radius?.trim() || null,
				radiusM: data.radiusM ?? null,
				density: data.density?.trim() || derived.density,
				surfaceGravity: data.surfaceGravity?.trim() || derived.surfaceGravity,
				escapeVelocity: data.escapeVelocity?.trim() || derived.escapeVelocity,
				temperature: data.temperature?.trim() || null,
				age: data.age?.trim() || null,
				composition: data.composition?.trim() || null,
				atmosphere: data.atmosphere?.trim() || null,
				surfacePressure: data.surfacePressure?.trim() || null,
				orbitalPeriod: data.orbitalPeriod?.trim() || display.orbitalPeriod,
				orbitalPeriodDays: effectivePeriodDays,
				semiMajorAxis: data.semiMajorAxis?.trim() || display.semiMajorAxis,
				semiMajorAxisAu: data.semiMajorAxisAu ?? null,
				eccentricity: data.eccentricity ?? null,
				inclination: data.inclination ?? null,
				epochPhase: data.epochPhase ?? null,
				rotationPeriod: data.rotationPeriod?.trim() || display.rotationPeriod,
				rotationPeriodS: data.rotationPeriodS ?? null,
				axialTilt: data.axialTilt ?? null,
				apparentMagnitude: data.apparentMagnitude?.trim() || null,
				angularDiameter: data.angularDiameter?.trim() || null,
				albedo: data.albedo?.trim() || null,
				satellites: data.satellites ?? null,
				hasRings: data.hasRings ?? false,
				extra: data.extra ?? {},
				description: data.description?.trim() || '',
			})
			.returning()

		await ensurePlanetaryBodyContentRecord(tx, inserted)

		const [updated] = await tx
			.select()
			.from(planetaryBodies)
			.where(eq(planetaryBodies.id, inserted.id))

		return updated ?? inserted
	})

	return json(created, { status: 201 })
}
