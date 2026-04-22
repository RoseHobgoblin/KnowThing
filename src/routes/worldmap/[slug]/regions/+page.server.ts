import type { PageServerLoad } from './$types.js'
import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '$lib/server/guards.js'

export const load: PageServerLoad = async (event) => {
	requireAdmin(event)
	const { slug } = event.params

	const mapRows = await db.execute(sql`
		SELECT
			wm.id,
			wm.name,
			wm.slug,
			wm.image_filename AS "imageFilename",
			m.mime_type AS "imageMimeType",
			(m.id IS NOT NULL) AS "hasUploadedSource"
		FROM world_maps wm
		LEFT JOIN media m ON m.filename = wm.image_filename
		WHERE wm.slug = ${slug}
		LIMIT 1
	`)
	const map = mapRows[0]
	if (!map) {
		throw error(404, 'Map not found')
	}

	const regionRows = await db.execute(sql`
		SELECT
			r.id,
			r.hex_color AS "hexColor",
			r.label,
			c.id AS "countryId",
			c.slug AS "countrySlug",
			c.name AS "countryName",
			c.page_slug AS "pageSlug"
		FROM world_map_regions r
		LEFT JOIN countries c ON c.id = r.country_id
		WHERE r.map_id = ${map.id}
		ORDER BY r.hex_color ASC
	`)

	const knowPages = await db.execute(sql`
		SELECT slug, title
		FROM content_records
		WHERE domain = 'know'
		ORDER BY title ASC
	`)

	const assignedCount = regionRows.filter((row) => row.pageSlug && String(row.pageSlug).trim().length > 0).length

	return {
		map,
		regions: regionRows,
		knowPages,
		assignedCount,
		unassignedCount: regionRows.length - assignedCount,
	}
}
