import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createPlanetaryBodySchema } from '$lib/celestial/schema.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createBody, listBodies } from '$lib/server/services/planetary-bodies.js'

/** GET /api/planetary-bodies?star=slug — list bodies, optionally filtered by star */
export const GET: RequestHandler = async ({ url }) => {
	return json(await listBodies(url.searchParams.get('star')))
}

/** POST /api/planetary-bodies — create a body */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createPlanetaryBodySchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const body = await createBody(data)
		return json(body, { status: 201 })
	})
}
