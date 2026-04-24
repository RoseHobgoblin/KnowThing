import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, worldMaps } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { and, eq, sql } from 'drizzle-orm'
import { parseBody } from '$lib/server/utils.js'
import { updateWorldMapSchema } from '$lib/worldmap/schema.js'

export const GET: RequestHandler = async ({ params }) => {
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
			wm.content_record_id AS "contentRecordId",
			wm.created_at AS "createdAt",
			wm.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.map_id = wm.id) AS "regionCount",
			(SELECT COUNT(*)::int FROM world_map_region_geometry g JOIN world_map_regions r ON r.id = g.region_id WHERE r.map_id = wm.id) AS "pathCount"
		FROM world_maps wm
		WHERE wm.slug = ${params.slug.toLowerCase()}
		LIMIT 1
	`)

	const map = rows[0]
	if (!map) {
		return json({ error: 'Map not found' }, { status: 404 })
	}

	return json(map)
}

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateWorldMapSchema)
	if (data instanceof Response) return data

	const slug = event.params.slug.toLowerCase()
	const [current] = await db
		.select({ id: worldMaps.id, slug: worldMaps.slug })
		.from(worldMaps)
		.where(eq(worldMaps.slug, slug))

	if (!current) {
		return json({ error: 'Map not found' }, { status: 404 })
	}

	if (data.slug && data.slug.trim().toLowerCase() !== current.slug) {
		const [conflict] = await db
			.select({ id: worldMaps.id })
			.from(worldMaps)
			.where(and(
				eq(worldMaps.slug, data.slug.trim().toLowerCase()),
				sql`${worldMaps.id} <> ${current.id}`,
			))
		if (conflict) {
			return json({ error: 'A map with this slug already exists' }, { status: 409 })
		}
	}

	let nextLinkedPageSlug: string | null | undefined
	let nextContentRecordId = data.contentRecordId

	if (data.linkedPageSlug !== undefined) {
		nextLinkedPageSlug = data.linkedPageSlug?.trim() || null

		if (nextLinkedPageSlug) {
			const [record] = await db
				.select({ id: contentRecords.id })
				.from(contentRecords)
				.where(and(
					eq(contentRecords.domain, 'know'),
					eq(contentRecords.slug, nextLinkedPageSlug),
				))

			if (!record) {
				return json({ error: `Linked wiki page not found: ${nextLinkedPageSlug}` }, { status: 400 })
			}

			nextContentRecordId = record.id
		} else {
			nextContentRecordId = null
		}
	}

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
			contentRecordId: nextContentRecordId,
			updatedAt: new Date(),
		})
		.where(eq(worldMaps.id, current.id))
		.returning()

	return json(updated)
}

export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const slug = event.params.slug.toLowerCase()
	const [deleted] = await db
		.delete(worldMaps)
		.where(eq(worldMaps.slug, slug))
		.returning({ id: worldMaps.id })

	if (!deleted) {
		return json({ error: 'Map not found' }, { status: 404 })
	}

	return json({ ok: true })
}
