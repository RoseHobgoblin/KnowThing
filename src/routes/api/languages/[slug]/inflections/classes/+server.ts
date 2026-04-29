import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createParadigmClassSchema } from '$lib/server/http/languages/schemas.js'
import { createParadigmClass } from '$lib/server/services/inflections.js'

/** POST /api/languages/:slug/inflections/classes — create a paradigm class */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createParadigmClassSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createParadigmClass(event.params.slug, data), { status: 201 }))
}
