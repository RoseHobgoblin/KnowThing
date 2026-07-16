import { error } from '@sveltejs/kit'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { starSystems } from '$lib/server/db/schema.js'
import type { createSystemSchema, updateSystemSchema } from '$lib/celestial/schema.js'
import { applySlugUpdate, deleteCelestialEntity } from '$lib/server/celestial/update-helpers.js'
import { moveContentByDomainSlug } from '$lib/server/services/content-records.js'

type CreateSystemInput = z.infer<typeof createSystemSchema>
type UpdateSystemInput = z.infer<typeof updateSystemSchema>

export async function listSystems() {
	return db.execute(sql`
		SELECT
			ss.*,
			(SELECT COUNT(*) FROM stars WHERE system_id = ss.id)::int AS "starCount",
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ss.id)::int AS "planetCount"
		FROM star_systems ss
		ORDER BY ss.name
	`)
}

export async function getSystemBySlug(slug: string) {
	const result = await db.execute(sql`
		SELECT
			ss.*,
			(SELECT COUNT(*) FROM stars WHERE system_id = ss.id)::int AS "starCount",
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ss.id)::int AS "planetCount"
		FROM star_systems ss
		WHERE ss.slug = ${slug}
	`)
	if (!result.length) throw error(404, 'System not found')
	return result[0]
}

export async function createSystem(data: CreateSystemInput) {
	const slug = data.slug.trim().toLowerCase()
	const [existing] = await db.select({ id: starSystems.id }).from(starSystems).where(eq(starSystems.slug, slug))
	if (existing) throw error(409, 'A system with this slug already exists')

	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(starSystems)
			.values({
				name: data.name.trim(),
				slug,
				pageSlug: data.pageSlug?.trim() || null,
				systemType: data.systemType,
				description: data.description?.trim() || '',
				distanceLy: data.distanceLy ?? null,
				galacticX: data.galacticX ?? null,
				galacticY: data.galacticY ?? null,
				galacticZ: data.galacticZ ?? null,
				formationAge: data.formationAge?.trim() || null,
				designations: data.designations?.trim() || null,
				extra: data.extra ?? {},
			})
			.returning()

		const [updated] = await tx.select().from(starSystems).where(eq(starSystems.id, created.id))
		return updated ?? created
	})
}

export async function updateSystem(slug: string, data: UpdateSystemInput) {
	const setClause: Record<string, unknown> = { updatedAt: new Date() }
	if (data.name !== undefined) setClause.name = data.name.trim()
	if (data.slug !== undefined) {
		await applySlugUpdate(setClause, data.slug, slug, starSystems, starSystems.id, starSystems.slug)
	}
	if (data.pageSlug !== undefined) setClause.pageSlug = data.pageSlug?.trim() || null
	if (data.systemType !== undefined) setClause.systemType = data.systemType
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''
	if (data.distanceLy !== undefined) setClause.distanceLy = data.distanceLy ?? null
	if (data.galacticX !== undefined) setClause.galacticX = data.galacticX ?? null
	if (data.galacticY !== undefined) setClause.galacticY = data.galacticY ?? null
	if (data.galacticZ !== undefined) setClause.galacticZ = data.galacticZ ?? null
	if (data.formationAge !== undefined) setClause.formationAge = data.formationAge?.trim() || null
	if (data.designations !== undefined) setClause.designations = data.designations?.trim() || null
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx.update(starSystems).set(setClause).where(eq(starSystems.slug, slug)).returning()
		if (!saved) return null

		// Keep any legacy content record keyed to this entity's slug in sync.
		if (typeof setClause.slug === 'string' && setClause.slug !== slug) {
			await moveContentByDomainSlug(tx, 'celestial', slug, setClause.slug)
		}

		const [refetched] = await tx.select().from(starSystems).where(eq(starSystems.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) throw error(404, 'System not found')
	return updated
}

export async function deleteSystem(slug: string) {
	return deleteCelestialEntity(starSystems, starSystems.slug, slug, 'System')
}
