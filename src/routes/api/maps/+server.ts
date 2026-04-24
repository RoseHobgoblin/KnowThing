import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, worldMaps } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { and, eq, sql } from 'drizzle-orm'
import { parseBody } from '$lib/server/utils.js'
import { createWorldMapSchema } from '$lib/worldmap/schema.js'

export const GET: RequestHandler = async () => {
	const result = await db.execute(sql`
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

	return json(result)
}

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createWorldMapSchema)
	if (data instanceof Response) return data

	const normalizedSlug = data.slug.trim().toLowerCase()
	const [existing] = await db
		.select({ id: worldMaps.id })
		.from(worldMaps)
		.where(eq(worldMaps.slug, normalizedSlug))

	if (existing) {
		return json({ error: 'A map with this slug already exists' }, { status: 409 })
	}

	const linkedPageSlug = data.linkedPageSlug?.trim() || null
	let contentRecordId = data.contentRecordId ?? null

	if (linkedPageSlug) {
		const [record] = await db
			.select({ id: contentRecords.id })
			.from(contentRecords)
			.where(and(
				eq(contentRecords.domain, 'know'),
				eq(contentRecords.slug, linkedPageSlug),
			))

		if (!record) {
			return json({ error: `Linked wiki page not found: ${linkedPageSlug}` }, { status: 400 })
		}

		contentRecordId = record.id
	}

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
			contentRecordId,
		})
		.returning()

	return json(map, { status: 201 })
}
