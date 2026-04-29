import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createWorldMapSchema } from '$lib/worldmap/schema.js'
import { createMap, listMaps } from '$lib/server/services/maps.js'

export const GET: RequestHandler = async () => {
	return json(await listMaps())
}

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createWorldMapSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createMap(data), { status: 201 }))
}
