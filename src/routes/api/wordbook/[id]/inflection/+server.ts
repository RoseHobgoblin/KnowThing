import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { getInflectionTable } from '$lib/server/wordbook/inflection.js'
import { updateEntryInflection } from '$lib/server/services/wordbook.js'

/** GET /api/wordbook/:id/inflection — get inflection table */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = Number.parseInt(params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const table = await getInflectionTable(entryId)
	return json(table)
}

/** PUT /api/wordbook/:id/inflection — set class + stem + overrides */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const entryId = Number.parseInt(event.params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { classId, stem, overrides } = body as {
		classId?: number | null
		stem?: string
		overrides?: Record<string, string>
	}

	try {
		const table = await updateEntryInflection(entryId, { classId, stem, overrides })
		return json(table)
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
