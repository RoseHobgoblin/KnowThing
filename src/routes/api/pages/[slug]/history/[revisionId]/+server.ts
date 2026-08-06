import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { getPageRevision, restorePageRevision } from '$lib/server/services/pages.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** GET /api/pages/:slug/history/:revisionId — get specific revision */
export const GET: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const id = Number.parseInt(event.params.revisionId)
	if (Number.isNaN(id)) return json({ error: 'Invalid revision ID' }, { status: 400 })

	const domain = event.url.searchParams.get('domain') || 'know'
	return handleServiceCall(async () => json(await getPageRevision(domain, event.params.slug, id)))
}

/** POST /api/pages/:slug/history/:revisionId — roll the page back to this revision */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const id = Number.parseInt(event.params.revisionId)
	if (Number.isNaN(id)) return json({ error: 'Invalid revision ID' }, { status: 400 })

	const domain = event.url.searchParams.get('domain') || 'know'
	return handleServiceCall(async () =>
		json(await restorePageRevision(domain, event.params.slug, id, user.id)))
}
