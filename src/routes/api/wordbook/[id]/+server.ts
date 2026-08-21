import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import {
	deleteWordbookEntry,
	getWordbookEntry,
	updateWordbookEntry,
} from '$lib/feature/wordbook/public/server/entries.server.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateWordSchema } from '$lib/feature/wordbook/public/server/schemas.server.js'

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (Number.isNaN(id)) return null
	return id
}

/** GET /api/wordbook/:id — single entry with all definitions */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await getWordbookEntry(id)))
}

/** PUT /api/wordbook/:id — update headword fields only */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, updateWordSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateWordbookEntry(id, data, user.id)))
}

/** DELETE /api/wordbook/:id — delete entire entry.
 * Editor-tier like every other entry mutation (rationalized from admin): the
 * final revision snapshot survives the delete, so this is recoverable. */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await deleteWordbookEntry(id, user.id)))
}
