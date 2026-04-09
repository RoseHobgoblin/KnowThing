import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { starSystems } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { updateSystemSchema } from '$lib/celestial/schema.js'
import { parseBody } from '$lib/server/utils.js'
import {
	deleteCelestialContentRecord,
	ensureSystemContentRecord,
} from '$lib/server/services/celestial-content.js'

/** GET /api/star-systems/:slug — full system with stars and planets */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db.execute(sql`
		SELECT
			ss.*,
			(SELECT COUNT(*) FROM stars WHERE system_id = ss.id)::int AS "starCount",
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ss.id)::int AS "planetCount"
		FROM star_systems ss
		WHERE ss.slug = ${params.slug}
	`)

	if (!result.length) {
		return json({ error: 'System not found' }, { status: 404 })
	}

	return json(result[0])
}

/** PUT /api/star-systems/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateSystemSchema)
	if (data instanceof Response) return data
	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (data.name !== undefined) setClause.name = data.name.trim()
	if (data.pageSlug !== undefined) setClause.pageSlug = data.pageSlug?.trim() || null
	if (data.systemType !== undefined) setClause.systemType = data.systemType
	if (data.description !== undefined) setClause.description = data.description?.trim() || ''
	if (data.extra !== undefined) setClause.extra = data.extra ?? {}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx
			.update(starSystems)
			.set(setClause)
			.where(eq(starSystems.slug, event.params.slug))
			.returning()

		if (!saved) return null

		await ensureSystemContentRecord(tx, saved)

		const [refetched] = await tx.select().from(starSystems).where(eq(starSystems.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) {
		return json({ error: 'System not found' }, { status: 404 })
	}

	return json(updated)
}

/** DELETE /api/star-systems/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const deleted = await db.transaction(async (tx) => {
		const [removed] = await tx
			.delete(starSystems)
			.where(eq(starSystems.slug, event.params.slug))
			.returning()

		if (!removed) return null

		await deleteCelestialContentRecord(tx, removed.contentRecordId)
		return removed
	})

	if (!deleted) {
		return json({ error: 'System not found' }, { status: 404 })
	}

	return json({ success: true })
}
