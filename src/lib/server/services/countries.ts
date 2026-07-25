import { error } from '@sveltejs/kit'
import { and, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { countries } from '$lib/server/db/schema.js'
import {
	archiveEntity,
	mintOrAttachFacetEntity,
	repointCanonicalRoute,
	type EntitySpineDatabase,
} from '$lib/server/services/entity-spine.js'
import { mintEntitySlug } from '$lib/utils/slugify.js'
import type { createCountrySchema, updateCountrySchema } from '$lib/worldmap/schema.js'

type CreateCountryInput = z.infer<typeof createCountrySchema>
type UpdateCountryInput = z.infer<typeof updateCountrySchema>

export async function listCountries() {
	return db.execute(sql`
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
}

export async function getCountryBySlug(slug: string) {
	const result = await db.execute(sql`
		SELECT
			c.id,
			c.name,
			c.slug,
			c.page_slug AS "pageSlug",
			c.capital,
			c.governance,
			c.color,
			c.extra,
			c.created_at AS "createdAt",
			c.updated_at AS "updatedAt",
			(SELECT COUNT(*)::int FROM world_map_regions r WHERE r.country_id = c.id) AS "regionCount"
		FROM countries c
		WHERE c.slug = ${slug.toLowerCase()}
		LIMIT 1
	`)

	const country = result[0]
	if (!country) throw error(404, 'Country not found')
	return country
}

async function hasCountryFacet(tx: EntitySpineDatabase, entityId: number): Promise<boolean> {
	const [row] = await tx
		.select({ id: countries.id })
		.from(countries)
		.where(eq(countries.entityId, entityId))
		.limit(1)
	return !!row
}

export async function createCountry(data: CreateCountryInput) {
	const normalizedSlug = data.slug.trim().toLowerCase()
	const [existing] = await db
		.select({ id: countries.id })
		.from(countries)
		.where(eq(countries.slug, normalizedSlug))

	if (existing) throw error(409, 'A country with this slug already exists')

	return db.transaction(async (tx) => {
		const [country] = await tx
			.insert(countries)
			.values({
				name: data.name.trim(),
				slug: normalizedSlug,
				pageSlug: data.pageSlug.trim(),
				capital: data.capital?.trim() || null,
				governance: data.governance?.trim() || null,
				color: data.color ?? null,
				extra: data.extra,
			})
			.returning()

		// Compatibility writer (0049): canonical know route in wiki style; the
		// hyphen slug lives on as a noncanonical alias.
		const { entityId } = await mintOrAttachFacetEntity(tx, {
			displayName: country.name,
			namespace: 'know',
			legacySlugs: [country.slug],
			hasFacet: id => hasCountryFacet(tx, id),
		})
		const [attached] = await tx
			.update(countries)
			.set({ entityId })
			.where(eq(countries.id, country.id))
			.returning()
		return attached
	})
}

export async function updateCountry(slug: string, data: UpdateCountryInput) {
	const normalized = slug.toLowerCase()
	const [current] = await db
		.select({ id: countries.id, slug: countries.slug, name: countries.name, entityId: countries.entityId })
		.from(countries)
		.where(eq(countries.slug, normalized))

	if (!current) throw error(404, 'Country not found')

	if (data.slug && data.slug.trim().toLowerCase() !== current.slug) {
		const [conflict] = await db
			.select({ id: countries.id })
			.from(countries)
			.where(and(
				eq(countries.slug, data.slug.trim().toLowerCase()),
				sql`${countries.id} <> ${current.id}`,
			))
		if (conflict) throw error(409, 'A country with this slug already exists')
	}

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(countries)
			.set({
				name: data.name?.trim(),
				slug: data.slug?.trim().toLowerCase(),
				pageSlug: data.pageSlug?.trim(),
				capital: data.capital?.trim() || (data.capital === null ? null : undefined),
				governance: data.governance?.trim() || (data.governance === null ? null : undefined),
				color: data.color === undefined ? undefined : data.color,
				extra: data.extra,
				updatedAt: new Date(),
			})
			.where(eq(countries.id, current.id))
			.returning()

		// Rename → canonical route follows the name (old address 301s); a
		// changed hyphen slug is preserved as a noncanonical alias.
		if (updated.entityId != null && (updated.name !== current.name || updated.slug !== current.slug)) {
			await repointCanonicalRoute(tx, updated.entityId, {
				namespace: 'know',
				slug: mintEntitySlug('know', updated.name),
				displayName: updated.name,
				legacySlugs: [updated.slug],
			})
		}
		return updated
	})
}

export async function deleteCountry(slug: string) {
	const normalized = slug.toLowerCase()
	return db.transaction(async (tx) => {
		const [deleted] = await tx
			.delete(countries)
			.where(eq(countries.slug, normalized))
			.returning({ id: countries.id, entityId: countries.entityId })

		if (!deleted) throw error(404, 'Country not found')
		// Archive, never hard-delete: routes keep resolving (banner, not 404).
		await archiveEntity(tx, deleted.entityId)
		return { ok: true }
	})
}
