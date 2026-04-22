import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'
import { assignWorldMapRegionsToKnowPages } from '$lib/server/services/worldmap.js'

const assignRegionsSchema = z.object({
	assignments: z.array(z.object({
		regionId: z.number().int().positive(),
		pageSlug: z.string().min(1, 'Page slug is required'),
	})).min(1, 'At least one assignment is required'),
})

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, assignRegionsSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const result = await assignWorldMapRegionsToKnowPages(event.params.slug, data.assignments)
		return json(result)
	})
}
