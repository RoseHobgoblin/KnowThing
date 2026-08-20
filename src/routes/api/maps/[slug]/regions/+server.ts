import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'
import { assignWorldMapRegionsToKnowPages } from '$lib/feature/worldmap/server/service.server.js'
import { assignRegionsSchema } from '$lib/feature/worldmap/server/schemas.server.js'

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, assignRegionsSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const result = await assignWorldMapRegionsToKnowPages(event.params.slug, data.assignments)
		return json(result)
	})
}
