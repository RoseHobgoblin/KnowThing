import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { stars, planetaryBodies } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createStarSchema } from '$lib/celestial/schema.js'

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

	const body = await event.request.json()
	const parsed = createStarSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const data = parsed.data

	// Check slug uniqueness
	const [existing] = await db.select({ id: stars.id }).from(stars).where(eq(stars.slug, data.slug))
	if (existing) {
		return json({ error: 'A star with this slug already exists' }, { status: 409 })
	}

	const [star] = await db
		.insert(stars)
		.values({
			name: data.name.trim(),
			slug: data.slug.trim().toLowerCase(),
			pageSlug: data.pageSlug?.trim() || null,
			spectralType: data.spectralType?.trim() || null,
			mass: data.mass?.trim() || null,
			radius: data.radius?.trim() || null,
			luminosity: data.luminosity?.trim() || null,
			luminosityVisual: data.luminosityVisual?.trim() || null,
			temperature: data.temperature?.trim() || null,
			age: data.age?.trim() || null,
			color: data.color?.trim() || null,
			orbitalPeriod: data.orbitalPeriod?.trim() || null,
			semiMajorAxis: data.semiMajorAxis?.trim() || null,
			semiMajorAxisAu: data.semiMajorAxisAu ?? null,
			eccentricity: data.eccentricity ?? null,
			periastron: data.periastron?.trim() || null,
			apastron: data.apastron?.trim() || null,
			apparentMagnitude: data.apparentMagnitude?.trim() || null,
			angularDiameter: data.angularDiameter?.trim() || null,
			companion: data.companion?.trim() || null,
			parentStarId: data.parentStarId ?? null,
			extra: data.extra ?? {},
			description: data.description?.trim() || '',
		})
		.returning()

	return json(star, { status: 201 })
}
