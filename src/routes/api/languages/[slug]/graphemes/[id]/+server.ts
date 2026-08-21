import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateGraphemeSchema } from '$lib/feature/wordbook/public/server/language-schemas.server.js'
import { deleteGrapheme, updateGrapheme } from '$lib/feature/wordbook/public/server/graphemes.server.js'

function parseId(raw: string) {
	const id = Number(raw)
	if (!Number.isInteger(id)) return null
	return id
}

/** PATCH /api/languages/:slug/graphemes/:id */
export const PATCH: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid id' }, { status: 400 })

	const data = await parseBody(event.request, updateGraphemeSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateGrapheme(event.params.slug, id, data)))
}

/** DELETE /api/languages/:slug/graphemes/:id */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid id' }, { status: 400 })

	return handleServiceCall(async () => json(await deleteGrapheme(event.params.slug, id)))
}
