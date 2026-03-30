import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars, planetaryBodies, stars, starSystems } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { redirect, error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/auth/login')
	if (locals.user.role !== 'admin') error(403, 'Admin access required')

	const id = Number.parseInt(params.id)
	if (isNaN(id)) error(400, 'Invalid ID')

	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) error(404, 'Calendar not found')

	// Load planets for the planet link dropdown
	const planets = await db.execute(sql`
		SELECT pb.id, pb.name, pb.slug,
			pb.orbital_period_days AS "orbitalPeriodDays",
			pb.rotation_period_s AS "rotationPeriodS",
			s.name AS "starName",
			ss.name AS "systemName"
		FROM planetary_bodies pb
		LEFT JOIN stars s ON s.id = pb.star_id
		LEFT JOIN star_systems ss ON ss.id = s.system_id
		WHERE pb.body_type = 'planet'
		ORDER BY ss.name, s.name, pb.name
	`)

	return { calendar: cal, planets }
}
