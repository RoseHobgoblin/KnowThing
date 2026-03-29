import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { stars, planetaryBodies } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'

export const load: PageServerLoad = async ({ params, locals }) => {
	const isAdmin = locals.user?.role === 'admin'

	// Try stars first, then planetary bodies
	const [star] = await db.select().from(stars).where(eq(stars.slug, params.slug))
	if (star) {
		return { kind: 'star' as const, body: star, isAdmin }
	}

	const [planet] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, params.slug))
	if (planet) {
		const allStars = await db.select({ id: stars.id, name: stars.name, slug: stars.slug }).from(stars).orderBy(stars.name)
		const siblings = planet.starId
			? await db.select({ id: planetaryBodies.id, name: planetaryBodies.name, slug: planetaryBodies.slug })
				.from(planetaryBodies)
				.where(eq(planetaryBodies.starId, planet.starId))
			: []
		return { kind: 'planet' as const, body: planet, allStars, siblings, isAdmin }
	}

	error(404, 'Celestial body not found')
}
