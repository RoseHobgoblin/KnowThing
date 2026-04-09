import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { addEntryDefinition, replaceEntryDefinitions } from '$lib/server/services/wordbook.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** POST /api/wordbook/:id/definitions — add a new sense */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { partOfSpeech, definition, usageExample, usageTranslation } = body as {
		partOfSpeech?: string
		definition: string
		usageExample?: string
		usageTranslation?: string
	}

	if (!definition?.trim()) {
		return json({ error: 'Definition is required' }, { status: 400 })
	}

	return handleServiceCall(async () => {
		const def = await addEntryDefinition(entryId, { partOfSpeech, definition, usageExample, usageTranslation })
		return json(def, { status: 201 })
	})
}

/** PUT /api/wordbook/:id/definitions — bulk replace all definitions atomically */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { defs } = body as {
		defs: Array<{ partOfSpeech?: string, definition: string, usageExample?: string, usageTranslation?: string }>
	}

	if (!defs || defs.length === 0 || !defs.some(d => d.definition?.trim())) {
		return json({ error: 'At least one definition is required' }, { status: 400 })
	}

	return handleServiceCall(async () => {
		const result = await replaceEntryDefinitions(entryId, defs, user.id)
		return json(result)
	})
}
