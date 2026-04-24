import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { countries } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { and, eq, sql } from 'drizzle-orm'
import { parseBody } from '$lib/server/utils.js'
import { updateCountrySchema } from '$lib/worldmap/schema.js'

export const GET: RequestHandler = async ({ params }) => {
	const result = await db.execute(sql`
		SELECT
			c.id,
			c.name,
			c.slug,
			c.page_slug AS "pageSlug",
			c.content_record_id AS "contentRecordId",
			c.capital,
			c.governance,
			c.color,
			c.extra,
			c.created_at AS "createdAt",
			c.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.country_id = c.id) AS "regionCount"
		FROM countries c
		WHERE c.slug = ${params.slug.toLowerCase()}
		LIMIT 1
	`)

	const country = result[0]
	if (!country) {
		return json({ error: 'Country not found' }, { status: 404 })
	}

	return json(country)
}

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const { params } = event
	const data = await parseBody(event.request, updateCountrySchema)
	if (data instanceof Response) return data

	const slug = params.slug.toLowerCase()
	const [current] = await db
		.select({ id: countries.id, slug: countries.slug })
		.from(countries)
		.where(eq(countries.slug, slug))

	if (!current) {
		return json({ error: 'Country not found' }, { status: 404 })
	}

	if (data.slug && data.slug.trim().toLowerCase() !== current.slug) {
		const [conflict] = await db
			.select({ id: countries.id })
			.from(countries)
			.where(and(
				eq(countries.slug, data.slug.trim().toLowerCase()),
				sql`${countries.id} <> ${current.id}`,
			))
		if (conflict) {
			return json({ error: 'A country with this slug already exists' }, { status: 409 })
		}
	}

	const [updated] = await db
		.update(countries)
		.set({
			name: data.name?.trim(),
			slug: data.slug?.trim().toLowerCase(),
			pageSlug: data.pageSlug?.trim(),
			contentRecordId: data.contentRecordId,
			capital: data.capital?.trim() || (data.capital === null ? null : undefined),
			governance: data.governance?.trim() || (data.governance === null ? null : undefined),
			color: data.color === undefined ? undefined : data.color,
			extra: data.extra,
			updatedAt: new Date(),
		})
		.where(eq(countries.id, current.id))
		.returning()

	return json(updated)
}

export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const slug = event.params.slug.toLowerCase()
	const [deleted] = await db
		.delete(countries)
		.where(eq(countries.slug, slug))
		.returning({ id: countries.id })

	if (!deleted) {
		return json({ error: 'Country not found' }, { status: 404 })
	}

	return json({ ok: true })
}
