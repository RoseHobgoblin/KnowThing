import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const maps = await db.execute(sql`
		SELECT
			wm.id,
			wm.name,
			wm.slug,
			wm.time_period AS "timePeriod",
			wm.event AS "event",
			wm.linked_page_slug AS "linkedPageSlug",
			wm.description,
			wm.image_width AS "imageWidth",
			wm.image_height AS "imageHeight",
			wm.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.map_id = wm.id) AS "regionCount"
		FROM world_maps wm
		ORDER BY wm.name ASC
	`)

	const knowPages = await db.execute(sql`
		SELECT slug, title
		FROM content_records
		WHERE domain = 'know'
		ORDER BY title ASC
	`)

	return { maps, knowPages }
}
