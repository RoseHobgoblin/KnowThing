import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateWorldMapSchema } from '$lib/feature/worldmap/public/worldmap-contracts.js'
import { deleteMap, getMapBySlug, updateMap } from '$lib/feature/worldmap/public/server/maps.server.js'

export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getMapBySlug(params.slug)))
}

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateWorldMapSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateMap(event.params.slug, data)))
}

export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteMap(event.params.slug)))
}
