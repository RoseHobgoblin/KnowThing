import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { starSystems } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { createSystemSchema } from '$lib/celestial/schema.js'
import { ensureSystemContentRecord } from '$lib/server/services/celestial-content.js'

/** GET /api/star-systems — list all systems with star/planet counts */
export const GET: RequestHandler = async () => {
	const result = await db.execute(sql`
		SELECT
			ss.*,
			(SELECT COUNT(*) FROM stars WHERE system_id = ss.id)::int AS "starCount",
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ss.id)::int AS "planetCount"
		FROM star_systems ss
		ORDER BY ss.name
	`)

	return json(result)
}

/** POST /api/star-systems — create a system */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const body = await event.request.json()
	const parsed = createSystemSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const data = parsed.data

	const [existing] = await db.select({ id: starSystems.id }).from(starSystems).where(eq(starSystems.slug, data.slug))
	if (existing) {
		return json({ error: 'A system with this slug already exists' }, { status: 409 })
	}

	const system = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(starSystems)
			.values({
				name: data.name.trim(),
				slug: data.slug.trim().toLowerCase(),
				pageSlug: data.pageSlug?.trim() || null,
				systemType: data.systemType,
				description: data.description?.trim() || '',
				extra: data.extra ?? {},
			})
			.returning()

		await ensureSystemContentRecord(tx, created)

		const [updated] = await tx
			.select()
			.from(starSystems)
			.where(eq(starSystems.id, created.id))

		return updated ?? created
	})

	return json(system, { status: 201 })
}
