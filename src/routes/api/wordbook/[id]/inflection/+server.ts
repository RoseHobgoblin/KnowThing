import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { getInflectionTable } from '$lib/feature/wordbook/public/server/inflection.server.js'
import { updateEntryInflection } from '$lib/feature/wordbook/public/server/entry-inflections.server.js'
import { updateInflectionSchema } from '$lib/feature/wordbook/public/server/schemas.server.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'

/** GET /api/wordbook/:id/inflection — get inflection table */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = Number.parseInt(params.id)
	if (Number.isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await getInflectionTable(entryId)))
}

/** PUT /api/wordbook/:id/inflection — set class + stem + overrides */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const entryId = Number.parseInt(event.params.id)
	if (Number.isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, updateInflectionSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const table = await updateEntryInflection(entryId, data, user.id)
		return json(table)
	})
}
