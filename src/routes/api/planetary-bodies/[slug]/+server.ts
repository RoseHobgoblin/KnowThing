import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { updatePlanetaryBodySchema } from '$lib/celestial/schema.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { deleteBody, getBodyBySlug, updateBody } from '$lib/server/services/planetary-bodies.js'

/** GET /api/planetary-bodies/:slug */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getBodyBySlug(params.slug)))
}

/** PUT /api/planetary-bodies/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, updatePlanetaryBodySchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateBody(event.params.slug, data)))
}

/** DELETE /api/planetary-bodies/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteBody(event.params.slug)))
}
