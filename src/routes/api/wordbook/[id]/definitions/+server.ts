import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { addEntryDefinition, replaceEntryDefinitions } from '$lib/feature/wordbook/public/server/definitions.server.js'
import { addDefinitionSchema, replaceDefinitionsSchema } from '$lib/feature/wordbook/public/server/schemas.server.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'

/** POST /api/wordbook/:id/definitions — add a new sense */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	if (Number.isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, addDefinitionSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const def = await addEntryDefinition(entryId, data, user.id)
		return json(def, { status: 201 })
	})
}

/** PUT /api/wordbook/:id/definitions — bulk replace all definitions atomically */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	if (Number.isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, replaceDefinitionsSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const result = await replaceEntryDefinitions(entryId, data.defs, user.id)
		return json(result)
	})
}
