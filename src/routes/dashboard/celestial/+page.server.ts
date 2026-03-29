import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { stars, planetaryBodies } from '$lib/server/db/schema.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const allStars = await db.execute(sql`
		SELECT
			s.id, s.name, s.slug, s.spectral_type AS "spectralType", s.color,
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		ORDER BY s.name
	`)

	const allBodies = await db.execute(sql`
		SELECT
			pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			pb.star_id AS "starId", pb.parent_id AS "parentId",
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
	`)

	return { stars: allStars, bodies: allBodies }
}
