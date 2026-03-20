import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { definitions } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq, and, sql } from 'drizzle-orm'

/** PUT /api/wordbook/:id/definitions/:defId — edit a sense */
export const PUT: RequestHandler = async (event) => {
	requireAuth(event)

	const defId = Number.parseInt(event.params.defId)
	if (isNaN(defId)) return json({ error: 'Invalid definition ID' }, { status: 400 })

	const body = await event.request.json()
	const { partOfSpeech, definition, usageExample, usageTranslation } = body as {
		partOfSpeech?: string
		definition?: string
		usageExample?: string
		usageTranslation?: string
	}

	const [updated] = await db
		.update(definitions)
		.set({
			...(partOfSpeech !== undefined && { partOfSpeech: partOfSpeech?.trim() || null }),
			...(definition && { definition: definition.trim() }),
			...(usageExample !== undefined && { usageExample: usageExample?.trim() || null }),
			...(usageTranslation !== undefined && { usageTranslation: usageTranslation?.trim() || null }),
		})
		.where(eq(definitions.id, defId))
		.returning()

	if (!updated) return json({ error: 'Definition not found' }, { status: 404 })
	return json(updated)
}

/** DELETE /api/wordbook/:id/definitions/:defId — remove a sense (can't delete the last one) */
export const DELETE: RequestHandler = async (event) => {
	requireAuth(event)

	const entryId = Number.parseInt(event.params.id)
	const defId = Number.parseInt(event.params.defId)
	if (isNaN(defId)) return json({ error: 'Invalid definition ID' }, { status: 400 })

	// Check this isn't the last definition
	const [{ count }] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(definitions)
		.where(eq(definitions.entryId, entryId))

	if (Number(count) <= 1) {
		return json({ error: 'Cannot delete the last definition. Delete the entire entry instead.' }, { status: 400 })
	}

	const [deleted] = await db.delete(definitions).where(eq(definitions.id, defId)).returning()
	if (!deleted) return json({ error: 'Definition not found' }, { status: 404 })
	return json({ success: true })
}
