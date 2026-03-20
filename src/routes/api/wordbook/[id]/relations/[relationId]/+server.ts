import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexiconRelations } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** DELETE /api/wordbook/:id/relations/:relationId */
export const DELETE: RequestHandler = async (event) => {
	requireAuth(event)

	const relationId = Number.parseInt(event.params.relationId)
	if (isNaN(relationId)) return json({ error: 'Invalid relation ID' }, { status: 400 })

	const [deleted] = await db
		.delete(lexiconRelations)
		.where(eq(lexiconRelations.id, relationId))
		.returning()

	if (!deleted) {
		return json({ error: 'Relation not found' }, { status: 404 })
	}

	return json({ success: true })
}
