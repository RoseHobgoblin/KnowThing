import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { stars, starSystems } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createStarSchema, updateStarSchema } from '$lib/celestial/schema.js'
import { parseBody } from '$lib/server/utils.js'
import { ensureStarContentRecord, syncBodiesForStar } from '$lib/server/services/celestial-content.js'
import { computeLuminosity, computeOrbitalPeriodDays } from '$lib/celestial/compute.js'
import { applyNameUpdate, applyFieldUpdates, deleteCelestialEntity } from '$lib/server/celestial/update-helpers.js'

/** GET /api/stars/:slug */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db.execute(sql`
		SELECT
			s.*,
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		WHERE s.slug = ${params.slug}
	`)

	if (!result.length) {
		return json({ error: 'Star not found' }, { status: 404 })
	}

	return json(result[0])
}

/** PUT /api/stars/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateStarSchema)
	if (data instanceof Response) return data
	const [current] = await db.select().from(stars).where(eq(stars.slug, event.params.slug))
	if (!current) {
		return json({ error: 'Star not found' }, { status: 404 })
	}

	const merged = createStarSchema.safeParse({ ...current, ...data })
	if (!merged.success) {
		return json({ error: merged.error.issues[0].message }, { status: 400 })
	}

	if (data.systemId != null) {
		const [system] = await db.select({ id: starSystems.id }).from(starSystems).where(eq(starSystems.id, data.systemId))
		if (!system) {
			return json({ error: 'Star system not found' }, { status: 400 })
		}
	}

	if (data.parentStarId != null) {
		if (data.parentStarId === current.id) {
			return json({ error: 'A star cannot orbit itself' }, { status: 400 })
		}

		const [parentStar] = await db.select({ id: stars.id }).from(stars).where(eq(stars.id, data.parentStarId))
		if (!parentStar) {
			return json({ error: 'Parent star not found' }, { status: 400 })
		}
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) {
		await applyNameUpdate(setClause, data.name, current.slug, stars, stars.id, stars.slug)
	}
	applyFieldUpdates(setClause, data as Record<string, unknown>,
		['pageSlug', 'spectralType', 'luminosityVisual', 'age', 'color',
			'apparentMagnitude', 'absoluteMagnitude', 'angularDiameter',
			'metallicity', 'companion'],
		['massKg', 'radiusM', 'luminosityW', 'temperatureK',
			'rotationPeriodS', 'axialTilt', 'orbitalPeriodDays', 'semiMajorAxisAu',
			'eccentricity', 'parentStarId', 'systemId', 'epochPhase'],
	)
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''

	// Auto-compute luminosity from radius + temperature via Stefan-Boltzmann
	const finalRadiusM = data.radiusM !== undefined ? data.radiusM : current.radiusM
	const finalTempK = data.temperatureK !== undefined ? data.temperatureK : current.temperatureK
	if (data.luminosityW === undefined && finalRadiusM != null && finalTempK != null && finalRadiusM > 0 && finalTempK > 0) {
		setClause.luminosityW = computeLuminosity(finalRadiusM, finalTempK)
	}

	// Auto-compute binary orbital period from Kepler's law
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
		const [saved] = await tx
			.update(stars)
			.set(setClause)
			.where(eq(stars.slug, event.params.slug))
			.returning()

		if (!saved) return null

		await ensureStarContentRecord(tx, saved)
		await syncBodiesForStar(tx, saved.id)

		const [refetched] = await tx.select().from(stars).where(eq(stars.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) {
		return json({ error: 'Star not found' }, { status: 404 })
	}

	return json(updated)
}

/** DELETE /api/stars/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return deleteCelestialEntity(stars, stars.slug, event.params.slug, 'Star')
}
