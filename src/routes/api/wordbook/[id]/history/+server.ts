import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { listEntryRevisions } from '$lib/server/services/wordbook.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** GET /api/wordbook/:id/history — list an entry's revisions (metadata only) */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = Number.parseInt(params.id)
	if (Number.isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await listEntryRevisions(entryId)))
}
