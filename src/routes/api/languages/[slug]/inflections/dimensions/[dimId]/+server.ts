import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { inflectionDimensions } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** PUT /api/languages/:slug/inflections/dimensions/:dimId */
export const PUT: RequestHandler = async (event) => {
	requireAuth(event)
	const dimId = Number.parseInt(event.params.dimId)
	if (isNaN(dimId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { name, values, sortOrder } = body as { name?: string, values?: string[], sortOrder?: number }

	const [updated] = await db
		.update(inflectionDimensions)
		.set({
			...(name && { name: name.trim() }),
			...(values && { dimValues: values.map(v => v.trim()) }),
			...(sortOrder !== undefined && { sortOrder }),
		})
		.where(eq(inflectionDimensions.id, dimId))
		.returning()

	if (!updated) return json({ error: 'Dimension not found' }, { status: 404 })
	return json(updated)
}

/** DELETE /api/languages/:slug/inflections/dimensions/:dimId */
export const DELETE: RequestHandler = async (event) => {
	requireAuth(event)
	const dimId = Number.parseInt(event.params.dimId)
	if (isNaN(dimId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [deleted] = await db.delete(inflectionDimensions).where(eq(inflectionDimensions.id, dimId)).returning()
	if (!deleted) return json({ error: 'Dimension not found' }, { status: 404 })
	return json({ success: true })
}
