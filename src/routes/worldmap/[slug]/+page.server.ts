import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'

type RegionRow = {
	regionId: number
	hexColor: string
	label: string | null
	countryName: string | null
	pageSlug: string | null
	pathData: string | null
	sortOrder: number | null
}

export const load: PageServerLoad = async ({ params }) => {
	const mapRows = await db.execute(sql`
		SELECT
			wm.id,
			wm.name,
			wm.slug,
			wm.description,
			wm.image_width AS "imageWidth",
			wm.image_height AS "imageHeight",
			wm.water_hex AS "waterHex"
		FROM world_maps wm
		WHERE wm.slug = ${params.slug}
		LIMIT 1
	`)

	const map = mapRows[0]
	if (!map) {
		throw error(404, 'Map not found')
	}

	const rows = await db.execute<RegionRow>(sql`
		SELECT
			r.id AS "regionId",
			r.hex_color AS "hexColor",
			r.label,
			c.name AS "countryName",
			c.page_slug AS "pageSlug",
			g.path_data AS "pathData",
			g.sort_order AS "sortOrder"
		FROM world_map_regions r
		LEFT JOIN countries c ON c.id = r.country_id
		LEFT JOIN world_map_region_geometry g ON g.region_id = r.id
		WHERE r.map_id = ${map.id}
		ORDER BY r.id ASC, g.sort_order ASC
	`)

	const regionMap = new Map<number, {
		id: number
		hexColor: string
		label: string
		countryName: string
		pageSlug: string | null
		paths: string[]
	}>()

	for (const row of rows) {
		const current = regionMap.get(row.regionId)
		if (!current) {
			regionMap.set(row.regionId, {
				id: row.regionId,
				hexColor: row.hexColor,
				label: row.label || row.countryName || row.hexColor,
				countryName: row.countryName || row.hexColor,
				pageSlug: row.pageSlug,
				paths: row.pathData ? [row.pathData] : [],
			})
			continue
		}

		if (row.pathData) {
			current.paths.push(row.pathData)
		}
	}

	return {
		map,
		regions: Array.from(regionMap.values()),
	}
}
