import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { stars, starSystems } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createStarSchema, updateStarSchema } from '$lib/celestial/schema.js'

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

	const body = await event.request.json()
	const parsed = updateStarSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const data = parsed.data
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

	if (data.name !== undefined) setClause.name = data.name.trim()
	if (data.pageSlug !== undefined) setClause.pageSlug = data.pageSlug?.trim() || null
	if (data.spectralType !== undefined) setClause.spectralType = data.spectralType?.trim() || null
	if (data.mass !== undefined) setClause.mass = data.mass?.trim() || null
	if (data.radius !== undefined) setClause.radius = data.radius?.trim() || null
	if (data.luminosity !== undefined) setClause.luminosity = data.luminosity?.trim() || null
	if (data.luminosityVisual !== undefined) setClause.luminosityVisual = data.luminosityVisual?.trim() || null
	if (data.temperature !== undefined) setClause.temperature = data.temperature?.trim() || null
	if (data.age !== undefined) setClause.age = data.age?.trim() || null
	if (data.color !== undefined) setClause.color = data.color?.trim() || null
	if (data.orbitalPeriod !== undefined) setClause.orbitalPeriod = data.orbitalPeriod?.trim() || null
	if (data.semiMajorAxis !== undefined) setClause.semiMajorAxis = data.semiMajorAxis?.trim() || null
	if (data.semiMajorAxisAu !== undefined) setClause.semiMajorAxisAu = data.semiMajorAxisAu ?? null
	if (data.eccentricity !== undefined) setClause.eccentricity = data.eccentricity ?? null
	if (data.periastron !== undefined) setClause.periastron = data.periastron?.trim() || null
	if (data.apastron !== undefined) setClause.apastron = data.apastron?.trim() || null
	if (data.apparentMagnitude !== undefined) setClause.apparentMagnitude = data.apparentMagnitude?.trim() || null
	if (data.angularDiameter !== undefined) setClause.angularDiameter = data.angularDiameter?.trim() || null
	if (data.companion !== undefined) setClause.companion = data.companion?.trim() || null
	if (data.parentStarId !== undefined) setClause.parentStarId = data.parentStarId ?? null
	if (data.systemId !== undefined) setClause.systemId = data.systemId ?? null
	if (data.epochPhase !== undefined) setClause.epochPhase = data.epochPhase ?? null
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''

	const [updated] = await db
		.update(stars)
		.set(setClause)
		.where(eq(stars.slug, event.params.slug))
		.returning()

	if (!updated) {
		return json({ error: 'Star not found' }, { status: 404 })
	}

	return json(updated)
}

/** DELETE /api/stars/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const [deleted] = await db
		.delete(stars)
		.where(eq(stars.slug, event.params.slug))
		.returning()

	if (!deleted) {
		return json({ error: 'Star not found' }, { status: 404 })
	}

	return json({ success: true })
}
