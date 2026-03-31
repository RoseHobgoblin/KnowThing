import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { addEntryDefinition, replaceEntryDefinitions } from '$lib/server/services/wordbook.js'

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

	try {
		const def = await addEntryDefinition(entryId, { partOfSpeech, definition, usageExample, usageTranslation })
		return json(def, { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
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

	try {
		const result = await replaceEntryDefinitions(entryId, defs, user.id)
		return json(result)
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
