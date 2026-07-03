import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createStarSchema } from '$lib/celestial/schema.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createStar, listStars } from '$lib/server/services/stars.js'

/** GET /api/stars — list all stars with planet counts */
export const GET: RequestHandler = async () => {
	return json(await listStars())
}

/** POST /api/stars — create a star */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, createStarSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const star = await createStar(data)
		return json(star, { status: 201 })
	})
}
