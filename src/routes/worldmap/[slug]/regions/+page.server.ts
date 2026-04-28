import type { PageServerLoad } from './$types.js'
import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '$lib/server/guards.js'

type RegionRowWithGeometry = {
	id: number
	hexColor: string
	label: string | null
	countryId: number | null
	countrySlug: string | null
	countryName: string | null
	pageSlug: string | null
	pathData: string | null
	sortOrder: number | null
}

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
			(wm.image_width) AS "imageWidth",
			(wm.image_height) AS "imageHeight",
			wm.water_hex AS "waterHex",
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

	const regionRows = await db.execute<RegionRowWithGeometry>(sql`
		SELECT
			r.id,
			r.hex_color AS "hexColor",
			r.label,
			c.id AS "countryId",
			c.slug AS "countrySlug",
			c.name AS "countryName",
			c.page_slug AS "pageSlug",
			g.path_data AS "pathData",
			g.sort_order AS "sortOrder"
		FROM world_map_regions r
		LEFT JOIN countries c ON c.id = r.country_id
		LEFT JOIN world_map_region_geometry g ON g.region_id = r.id
		WHERE r.map_id = ${map.id}
		ORDER BY r.hex_color ASC, g.sort_order ASC
	`)

	const groupedRegions = new Map<number, {
		id: number
		hexColor: string
		label: string | null
		countryId: number | null
		countrySlug: string | null
		countryName: string | null
		pageSlug: string | null
		paths: Array<{ d: string, transform: string | null }>
	}>()

	for (const row of regionRows) {
		const current = groupedRegions.get(row.id)
		if (!current) {
			groupedRegions.set(row.id, {
				id: row.id,
				hexColor: row.hexColor,
				label: row.label,
				countryId: row.countryId,
				countrySlug: row.countrySlug,
				countryName: row.countryName,
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
				groupedRegions.get(row.id)!.paths.push({ d, transform })
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

	const knowPages = await db.execute(sql`
		SELECT slug, title
		FROM content_records
		WHERE domain = 'know'
		ORDER BY title ASC
	`)

	const svgMedia = await db.execute(sql`
		SELECT filename, mime_type AS "mimeType"
		FROM media
		WHERE mime_type = 'image/svg+xml'
		ORDER BY filename ASC
	`)

	const regions = Array.from(groupedRegions.values())
	const assignedCount = regions.filter((row) => row.pageSlug && String(row.pageSlug).trim().length > 0).length

	return {
		map,
		regions,
		knowPages,
		svgMedia,
		assignedCount,
		unassignedCount: regions.length - assignedCount,
	}
}
