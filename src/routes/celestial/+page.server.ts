import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
	const systems = await db.execute(sql`
		SELECT
			ss.id, ss.name, ss.slug, ss.system_type AS "systemType",
			ss.page_slug AS "pageSlug",
			(SELECT COUNT(*) FROM stars WHERE system_id = ss.id)::int AS "starCount",
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ss.id)::int AS "planetCount"
		FROM star_systems ss
		ORDER BY ss.name
	`)

	const allStars = await db.execute(sql`
		SELECT
			s.id, s.name, s.slug, s.spectral_type AS "spectralType",
			s.color, s.page_slug AS "pageSlug", s.system_id AS "systemId",
			s.semi_major_axis_au AS "semiMajorAxisAu", s.eccentricity,
			s.parent_star_id AS "parentStarId",
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		ORDER BY s.parent_star_id NULLS FIRST, s.name
	`)

	const allBodies = await db.execute(sql`
		SELECT
			pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			pb.star_id AS "starId", pb.parent_id AS "parentId",
			pb.page_slug AS "pageSlug",
			pb.semi_major_axis_au AS "semiMajorAxisAu", pb.eccentricity,
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
	`)

	return {
		systems,
		stars: allStars,
		bodies: allBodies,
	}
}
