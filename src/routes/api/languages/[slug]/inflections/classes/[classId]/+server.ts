import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateParadigmClassSchema } from '$lib/feature/wordbook/public/server/language-schemas.server.js'
import { deleteParadigmClass, getParadigmClass, updateParadigmClass } from '$lib/feature/wordbook/public/server/inflections.server.js'

function parseClassId(raw: string) {
	const id = Number.parseInt(raw)
	if (Number.isNaN(id)) return null
	return id
}

/** GET /api/languages/:slug/inflections/classes/:classId — class with all rules */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseClassId(params.classId)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await getParadigmClass(id)))
}

/** PUT /api/languages/:slug/inflections/classes/:classId — bulk update rules */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = parseClassId(event.params.classId)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, updateParadigmClassSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateParadigmClass(id, data)))
}

/** DELETE /api/languages/:slug/inflections/classes/:classId */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = parseClassId(event.params.classId)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await deleteParadigmClass(id)))
}
