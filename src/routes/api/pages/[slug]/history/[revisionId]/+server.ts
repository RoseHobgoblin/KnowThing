import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { getPageRevision } from '$lib/server/services/pages.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** GET /api/pages/:slug/history/:revisionId — get specific revision */
export const GET: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const id = Number.parseInt(event.params.revisionId)
	if (isNaN(id)) return json({ error: 'Invalid revision ID' }, { status: 400 })

	const domain = event.url.searchParams.get('domain') || 'know'
	return handleServiceCall(async () => json(await getPageRevision(domain, event.params.slug, id)))
}
