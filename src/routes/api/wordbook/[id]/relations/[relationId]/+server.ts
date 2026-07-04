import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteEntryRelation } from '$lib/server/services/wordbook.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** DELETE /api/wordbook/:id/relations/:relationId */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const relationId = Number.parseInt(event.params.relationId)
	if (Number.isNaN(entryId) || Number.isNaN(relationId)) return json({ error: 'Invalid relation ID' }, { status: 400 })

	return handleServiceCall(async () => {
		await deleteEntryRelation(entryId, relationId, user.id)
		return json({ success: true })
	})
}
