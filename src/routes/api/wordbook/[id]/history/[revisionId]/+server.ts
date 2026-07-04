import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { getEntryRevision, restoreEntryRevision } from '$lib/server/services/wordbook.js'
import { handleServiceCall } from '$lib/server/utils.js'

function parseIds(params: { id: string, revisionId: string }) {
	const entryId = Number.parseInt(params.id)
	const revisionId = Number.parseInt(params.revisionId)
	if (Number.isNaN(entryId) || Number.isNaN(revisionId)) return null
	return { entryId, revisionId }
}

/** GET /api/wordbook/:id/history/:revisionId — full snapshot of one revision */
export const GET: RequestHandler = async ({ params }) => {
	const ids = parseIds(params)
	if (!ids) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await getEntryRevision(ids.entryId, ids.revisionId)))
}

/** POST /api/wordbook/:id/history/:revisionId — restore the entry to this revision */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const ids = parseIds(event.params)
	if (!ids) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () =>
		json(await restoreEntryRevision(ids.entryId, ids.revisionId, user.id)))
}
