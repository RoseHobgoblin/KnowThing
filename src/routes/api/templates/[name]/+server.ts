import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { getTemplate } from '$lib/server/services/templates.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** GET /api/templates/:name — get template source */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getTemplate(params.name)))
}
