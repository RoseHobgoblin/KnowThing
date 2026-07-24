import { error } from '@sveltejs/kit'
import { and, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { worldMaps } from '$lib/server/db/schema.js'
import type { createWorldMapSchema, updateWorldMapSchema } from '$lib/worldmap/schema.js'

type CreateMapInput = z.infer<typeof createWorldMapSchema>
type UpdateMapInput = z.infer<typeof updateWorldMapSchema>

export async function listMapsForIndex() {
	return db.execute(sql`
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
}

export async function listKnowPageOptions() {
	return db.execute(sql`
		SELECT slug, title
		FROM content_records
		WHERE domain = 'know'
		ORDER BY title ASC
	`)
}

export async function getMapWithImage(slug: string) {
	const rows = await db.execute(sql`
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
		WHERE wm.slug = ${slug}
		LIMIT 1
	`)
	return rows[0] ?? null
}

export async function getMapForRegionsAdmin(slug: string) {
	const rows = await db.execute(sql`
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
	return rows[0] ?? null
}

export type MapRegionRow = {
	regionId: number
	hexColor: string
	label: string | null
	countryName: string | null
	pageSlug: string | null
	pathData: string | null
	sortOrder: number | null
}

export async function listMapRegionsWithGeometry(mapId: number) {
	return db.execute<MapRegionRow>(sql`
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
		WHERE r.map_id = ${mapId}
		ORDER BY r.id ASC, g.sort_order ASC
	`)
}

export type MapRegionAdminRow = {
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

export async function listMapRegionsForAdmin(mapId: number) {
	return db.execute<MapRegionAdminRow>(sql`
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
		WHERE r.map_id = ${mapId}
		ORDER BY r.hex_color ASC, g.sort_order ASC
	`)
}

export async function listSvgMedia() {
	return db.execute(sql`
		SELECT filename, mime_type AS "mimeType"
		FROM media
		WHERE mime_type = 'image/svg+xml'
		ORDER BY filename ASC
	`)
}

export async function listMaps() {
	return db.execute(sql`
		SELECT
			wm.id,
			wm.name,
			wm.slug,
			wm.image_filename AS "imageFilename",
			wm.image_width AS "imageWidth",
			wm.image_height AS "imageHeight",
			wm.water_hex AS "waterHex",
			wm.time_period AS "timePeriod",
			wm.event AS "event",
			wm.linked_page_slug AS "linkedPageSlug",
			wm.description,
			wm.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.map_id = wm.id) AS "regionCount"
		FROM world_maps wm
		ORDER BY wm.name ASC
	`)
}

export async function getMapBySlug(slug: string) {
	const rows = await db.execute(sql`
		SELECT
			wm.id,
			wm.name,
			wm.slug,
			wm.image_filename AS "imageFilename",
			wm.image_width AS "imageWidth",
			wm.image_height AS "imageHeight",
			wm.water_hex AS "waterHex",
			wm.time_period AS "timePeriod",
			wm.event AS "event",
			wm.linked_page_slug AS "linkedPageSlug",
			wm.description,
			wm.created_at AS "createdAt",
			wm.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.map_id = wm.id) AS "regionCount",
			(SELECT COUNT(*)::int FROM world_map_region_geometry g JOIN world_map_regions r ON r.id = g.region_id WHERE r.map_id = wm.id) AS "pathCount"
		FROM world_maps wm
		WHERE wm.slug = ${slug.toLowerCase()}
		LIMIT 1
	`)

	const map = rows[0]
	if (!map) throw error(404, 'Map not found')
	return map
}

export async function createMap(data: CreateMapInput) {
	const normalizedSlug = data.slug.trim().toLowerCase()
	const [existing] = await db
		.select({ id: worldMaps.id })
		.from(worldMaps)
		.where(eq(worldMaps.slug, normalizedSlug))

	if (existing) throw error(409, 'A map with this slug already exists')

	const linkedPageSlug = data.linkedPageSlug?.trim() || null

	const [map] = await db
		.insert(worldMaps)
		.values({
			name: data.name.trim(),
			slug: normalizedSlug,
			imageFilename: data.imageFilename?.trim() || `${normalizedSlug}.png`,
			imageWidth: data.imageWidth ?? null,
			imageHeight: data.imageHeight ?? null,
			waterHex: data.waterHex,
			timePeriod: data.timePeriod?.trim() || null,
			event: data.event?.trim() || null,
			linkedPageSlug,
			description: data.description?.trim() || '',
		})
		.returning()
	return map
}

export async function updateMap(slug: string, data: UpdateMapInput) {
	const normalized = slug.toLowerCase()
	const [current] = await db
		.select({ id: worldMaps.id, slug: worldMaps.slug })
		.from(worldMaps)
		.where(eq(worldMaps.slug, normalized))

	if (!current) throw error(404, 'Map not found')

	if (data.slug && data.slug.trim().toLowerCase() !== current.slug) {
		const [conflict] = await db
			.select({ id: worldMaps.id })
			.from(worldMaps)
			.where(and(
				eq(worldMaps.slug, data.slug.trim().toLowerCase()),
				sql`${worldMaps.id} <> ${current.id}`,
			))
		if (conflict) throw error(409, 'A map with this slug already exists')
	}

	const nextLinkedPageSlug = data.linkedPageSlug === undefined
		? undefined
		: (data.linkedPageSlug?.trim() || null)

	const [updated] = await db
		.update(worldMaps)
		.set({
			name: data.name?.trim(),
			slug: data.slug?.trim().toLowerCase(),
			imageFilename: data.imageFilename?.trim(),
			imageWidth: data.imageWidth,
			imageHeight: data.imageHeight,
			waterHex: data.waterHex,
			timePeriod: data.timePeriod?.trim() || (data.timePeriod === null ? null : undefined),
			event: data.event?.trim() || (data.event === null ? null : undefined),
			linkedPageSlug: nextLinkedPageSlug,
			description: data.description?.trim(),
			updatedAt: new Date(),
		})
		.where(eq(worldMaps.id, current.id))
		.returning()
	return updated
}

export async function deleteMap(slug: string) {
	const normalized = slug.toLowerCase()
	const [deleted] = await db
		.delete(worldMaps)
		.where(eq(worldMaps.slug, normalized))
		.returning({ id: worldMaps.id })

	if (!deleted) throw error(404, 'Map not found')
	return { ok: true }
}
