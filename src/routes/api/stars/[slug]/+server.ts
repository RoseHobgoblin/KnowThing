import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { updateStarSchema } from '$lib/celestial/schema.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { deleteStar, getStarBySlug, updateStar } from '$lib/server/services/stars.js'

/** GET /api/stars/:slug */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getStarBySlug(params.slug)))
}

/** PUT /api/stars/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, updateStarSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateStar(event.params.slug, data)))
}

/** DELETE /api/stars/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteStar(event.params.slug)))
}
