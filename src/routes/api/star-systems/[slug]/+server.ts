import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { updateSystemSchema } from '$lib/celestial/schema.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { deleteSystem, getSystemBySlug, updateSystem } from '$lib/server/services/star-systems.js'

/** GET /api/star-systems/:slug — full system with stars and planets */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getSystemBySlug(params.slug)))
}

/** PUT /api/star-systems/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateSystemSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateSystem(event.params.slug, data)))
}

/** DELETE /api/star-systems/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteSystem(event.params.slug)))
}
