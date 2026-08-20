import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateDimensionSchema } from '$lib/feature/wordbook/server/language-schemas.server.js'
import { deleteDimension, updateDimension } from '$lib/feature/wordbook/server/inflections.server.js'

function parseDimId(raw: string) {
	const id = Number.parseInt(raw)
	if (isNaN(id)) return null
	return id
}

/** PUT /api/languages/:slug/inflections/dimensions/:dimId */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = parseDimId(event.params.dimId)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, updateDimensionSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateDimension(id, data)))
}

/** DELETE /api/languages/:slug/inflections/dimensions/:dimId */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = parseDimId(event.params.dimId)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await deleteDimension(id)))
}
