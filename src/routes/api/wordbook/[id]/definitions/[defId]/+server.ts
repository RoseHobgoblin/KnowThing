import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteEntryDefinition, updateEntryDefinition } from '$lib/feature/wordbook/server/service.server.js'
import { updateDefinitionSchema } from '$lib/feature/wordbook/server/schemas.server.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'

/** PUT /api/wordbook/:id/definitions/:defId — edit a sense */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const defId = Number.parseInt(event.params.defId)
	if (Number.isNaN(entryId) || Number.isNaN(defId)) return json({ error: 'Invalid definition ID' }, { status: 400 })

	const data = await parseBody(event.request, updateDefinitionSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const updated = await updateEntryDefinition(entryId, defId, data, user.id)
		return json(updated)
	})
}

/** DELETE /api/wordbook/:id/definitions/:defId — remove a sense (can't delete the last one) */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const defId = Number.parseInt(event.params.defId)
	if (Number.isNaN(entryId) || Number.isNaN(defId)) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => {
		await deleteEntryDefinition(entryId, defId, user.id)
		return json({ success: true })
	})
}
