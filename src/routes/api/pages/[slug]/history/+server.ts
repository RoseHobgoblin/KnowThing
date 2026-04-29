import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { getPageHistory } from '$lib/server/services/pages.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** GET /api/pages/:slug/history?domain=know — revision list */
export const GET: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const domain = event.url.searchParams.get('domain') || 'know'
	return handleServiceCall(async () => json(await getPageHistory(domain, event.params.slug)))
}
