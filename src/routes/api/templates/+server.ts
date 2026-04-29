import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { listTemplates } from '$lib/server/services/templates.js'

/** GET /api/templates — list all templates */
export const GET: RequestHandler = async () => {
	return json(await listTemplates())
}
