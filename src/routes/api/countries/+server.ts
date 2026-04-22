import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { countries } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { parseBody } from '$lib/server/utils.js'
import { createCountrySchema } from '$lib/worldmap/schema.js'

export const GET: RequestHandler = async () => {
	const result = await db.execute(sql`
		SELECT
			c.id,
			c.name,
			c.slug,
			c.page_slug AS "pageSlug",
			c.capital,
			c.governance,
			c.color,
			c.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.country_id = c.id) AS "regionCount"
		FROM countries c
		ORDER BY c.name ASC
	`)

	return json(result)
}

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createCountrySchema)
	if (data instanceof Response) return data

	const normalizedSlug = data.slug.trim().toLowerCase()
	const [existing] = await db
		.select({ id: countries.id })
		.from(countries)
		.where(eq(countries.slug, normalizedSlug))

	if (existing) {
		return json({ error: 'A country with this slug already exists' }, { status: 409 })
	}

	const [country] = await db
		.insert(countries)
		.values({
			name: data.name.trim(),
			slug: normalizedSlug,
			pageSlug: data.pageSlug.trim(),
			contentRecordId: data.contentRecordId ?? null,
			capital: data.capital?.trim() || null,
			governance: data.governance?.trim() || null,
			color: data.color ?? null,
			extra: data.extra,
		})
		.returning()

	return json(country, { status: 201 })
}
