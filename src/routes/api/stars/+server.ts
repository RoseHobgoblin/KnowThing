import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { stars, planetaryBodies, starSystems } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createStarSchema } from '$lib/celestial/schema.js'
import { ensureStarContentRecord } from '$lib/server/services/celestial-content.js'
import { deriveBodyFields, deriveStarOrbitalFields, deriveDisplayStrings, computeLuminosity, formatLuminosity } from '$lib/celestial/compute.js'
import { parseBody } from '$lib/server/utils.js'

/** GET /api/stars — list all stars with planet counts */
export const GET: RequestHandler = async () => {
	const result = await db.execute(sql`
		SELECT
			s.*,
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		ORDER BY s.name
	`)

	return json(result)
}

/** POST /api/stars — create a star */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createStarSchema)
	if (data instanceof Response) return data

	if (data.systemId != null) {
		const [system] = await db.select({ id: starSystems.id }).from(starSystems).where(eq(starSystems.id, data.systemId))
		if (!system) {
			return json({ error: 'Star system not found' }, { status: 400 })
		}
	}

	if (data.parentStarId != null) {
		const [parentStar] = await db.select({ id: stars.id }).from(stars).where(eq(stars.id, data.parentStarId))
		if (!parentStar) {
			return json({ error: 'Parent star not found' }, { status: 400 })
		}
	}

	// Check slug uniqueness
	const [existing] = await db.select({ id: stars.id }).from(stars).where(eq(stars.slug, data.slug))
	if (existing) {
		return json({ error: 'A star with this slug already exists' }, { status: 409 })
	}

	// Auto-compute derived fields
	const physical = deriveBodyFields(data.massKg ?? null, data.radiusM ?? null)
	const orbital = deriveStarOrbitalFields(data.semiMajorAxisAu ?? null, data.eccentricity ?? null)
	const display = deriveDisplayStrings(data.orbitalPeriodDays ?? null, data.semiMajorAxisAu ?? null, data.rotationPeriodS ?? null)

	let derivedLuminosityW = data.luminosityW ?? null
	let derivedLuminosity = data.luminosity?.trim() || null
	if (derivedLuminosityW == null && data.radiusM != null && data.temperatureK != null && data.radiusM > 0 && data.temperatureK > 0) {
		derivedLuminosityW = computeLuminosity(data.radiusM, data.temperatureK)
		if (!derivedLuminosity) derivedLuminosity = formatLuminosity(derivedLuminosityW)
	}

	const star = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(stars)
			.values({
				name: data.name.trim(),
				slug: data.slug.trim().toLowerCase(),
				pageSlug: data.pageSlug?.trim() || null,
				spectralType: data.spectralType?.trim() || null,
				mass: data.mass?.trim() || null,
				massKg: data.massKg ?? null,
				radius: data.radius?.trim() || null,
				radiusM: data.radiusM ?? null,
				luminosity: derivedLuminosity,
				luminosityW: derivedLuminosityW,
				luminosityVisual: data.luminosityVisual?.trim() || null,
				temperature: data.temperature?.trim() || null,
				temperatureK: data.temperatureK ?? null,
				age: data.age?.trim() || null,
				color: data.color?.trim() || null,
				density: data.density?.trim() || physical.density,
				surfaceGravity: data.surfaceGravity?.trim() || physical.surfaceGravity,
				escapeVelocity: data.escapeVelocity?.trim() || physical.escapeVelocity,
				rotationPeriod: data.rotationPeriod?.trim() || display.rotationPeriod,
				rotationPeriodS: data.rotationPeriodS ?? null,
				axialTilt: data.axialTilt ?? null,
				orbitalPeriod: data.orbitalPeriod?.trim() || display.orbitalPeriod,
				orbitalPeriodDays: data.orbitalPeriodDays ?? null,
				semiMajorAxis: data.semiMajorAxis?.trim() || display.semiMajorAxis,
				semiMajorAxisAu: data.semiMajorAxisAu ?? null,
				eccentricity: data.eccentricity ?? null,
				periastron: data.periastron?.trim() || orbital.periastron,
				apastron: data.apastron?.trim() || orbital.apastron,
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

		const [updated] = await tx
			.select()
			.from(stars)
			.where(eq(stars.id, created.id))

		return updated ?? created
	})

	return json(star, { status: 201 })
}
