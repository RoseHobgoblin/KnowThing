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
			wm.image_filename AS "imageFilename",
			m.mime_type AS "imageMimeType",
			wm.description,
			wm.image_width AS "imageWidth",
			wm.image_height AS "imageHeight",
			wm.water_hex AS "waterHex"
		FROM world_maps wm
		LEFT JOIN media m ON m.filename = wm.image_filename
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
		paths: Array<{ d: string, transform: string | null }>
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
				paths: [],
			})
			if (row.pathData) {
				let d = row.pathData
				let transform = null
				if (d.startsWith('T:')) {
					const splitIdx = d.indexOf('|')
					if (splitIdx !== -1) {
						transform = d.slice(2, splitIdx).trim()
						d = d.slice(splitIdx + 1).trim()
					}
				}
				regionMap.get(row.regionId)!.paths.push({ d, transform })
			}
			continue
		}

		if (row.pathData) {
			let d = row.pathData
			let transform = null
			if (d.startsWith('T:')) {
				const splitIdx = d.indexOf('|')
				if (splitIdx !== -1) {
					transform = d.slice(2, splitIdx).trim()
					d = d.slice(splitIdx + 1).trim()
				}
			}
			current.paths.push({ d, transform })
		}
	}

	return {
		map,
		regions: Array.from(regionMap.values()),
	}
}
