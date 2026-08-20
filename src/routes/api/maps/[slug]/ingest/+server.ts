import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { ingestWorldMapBySlug } from '$lib/feature/worldmap/server/service.server.js'

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	return handleServiceCall(async () => {
		const result = await ingestWorldMapBySlug(event.params.slug)
		return json(result)
	})
}
