import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteEntryRelation } from '$lib/server/services/wordbook.js'

/** DELETE /api/wordbook/:id/relations/:relationId */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const relationId = Number.parseInt(event.params.relationId)
	if (isNaN(entryId) || isNaN(relationId)) return json({ error: 'Invalid relation ID' }, { status: 400 })

	try {
		await deleteEntryRelation(entryId, relationId)
		return json({ success: true })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
