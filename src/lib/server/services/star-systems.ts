import { error } from '@sveltejs/kit'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { starSystems } from '$lib/server/db/schema.js'
import type { createSystemSchema, updateSystemSchema } from '$lib/celestial/schema.js'
import { deleteCelestialEntity } from '$lib/server/celestial/update-helpers.js'
import { ensureSystemContentRecord } from '$lib/server/services/celestial-content.js'

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
				extra: data.extra ?? {},
			})
			.returning()

		await ensureSystemContentRecord(tx, created)

		const [updated] = await tx.select().from(starSystems).where(eq(starSystems.id, created.id))
		return updated ?? created
	})
}

export async function updateSystem(slug: string, data: UpdateSystemInput) {
	const setClause: Record<string, unknown> = { updatedAt: new Date() }
	if (data.name !== undefined) setClause.name = data.name.trim()
	if (data.pageSlug !== undefined) setClause.pageSlug = data.pageSlug?.trim() || null
	if (data.systemType !== undefined) setClause.systemType = data.systemType
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx.update(starSystems).set(setClause).where(eq(starSystems.slug, slug)).returning()
		if (!saved) return null

		await ensureSystemContentRecord(tx, saved)

		const [refetched] = await tx.select().from(starSystems).where(eq(starSystems.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) throw error(404, 'System not found')
	return updated
}

export async function deleteSystem(slug: string) {
	return deleteCelestialEntity(starSystems, starSystems.slug, slug, 'System')
}
