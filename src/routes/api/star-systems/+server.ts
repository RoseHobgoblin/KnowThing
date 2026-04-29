import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createSystemSchema } from '$lib/celestial/schema.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createSystem, listSystems } from '$lib/server/services/star-systems.js'

/** GET /api/star-systems — list all systems with star/planet counts */
export const GET: RequestHandler = async () => {
	return json(await listSystems())
}

/** POST /api/star-systems — create a system */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createSystemSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createSystem(data), { status: 201 }))
}
