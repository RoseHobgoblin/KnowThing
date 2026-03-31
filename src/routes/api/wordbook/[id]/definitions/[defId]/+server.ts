import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteEntryDefinition, updateEntryDefinition } from '$lib/server/services/wordbook.js'

/** PUT /api/wordbook/:id/definitions/:defId — edit a sense */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const defId = Number.parseInt(event.params.defId)
	if (isNaN(entryId) || isNaN(defId)) return json({ error: 'Invalid definition ID' }, { status: 400 })

	const body = await event.request.json()
	const { partOfSpeech, definition, usageExample, usageTranslation } = body as {
		partOfSpeech?: string
		definition?: string
		usageExample?: string
		usageTranslation?: string
	}

	try {
		const updated = await updateEntryDefinition(entryId, defId, { partOfSpeech, definition, usageExample, usageTranslation }, user.id)
		return json(updated)
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}

/** DELETE /api/wordbook/:id/definitions/:defId — remove a sense (can't delete the last one) */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const defId = Number.parseInt(event.params.defId)
	if (isNaN(entryId) || isNaN(defId)) return json({ error: 'Invalid ID' }, { status: 400 })

	try {
		await deleteEntryDefinition(entryId, defId, user.id)
		return json({ success: true })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
