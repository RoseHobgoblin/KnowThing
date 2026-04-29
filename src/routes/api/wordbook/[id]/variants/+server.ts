import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { addEntryVariant, listEntryVariants } from '$lib/server/services/wordbook.js'
import { handleServiceCall } from '$lib/server/utils.js'

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (isNaN(id)) return null
	return id
}

/** GET /api/wordbook/:id/variants */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = parseId(params.id)
	if (entryId == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await listEntryVariants(entryId)))
}

/** POST /api/wordbook/:id/variants */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const entryId = parseId(event.params.id)
	if (entryId == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { dialectId, pronunciation, spelling, notes } = body as {
		dialectId: number
		pronunciation?: string
		spelling?: string
		notes?: string
	}

	return handleServiceCall(async () => {
		const variant = await addEntryVariant(entryId, { dialectId, pronunciation, spelling, notes })
		return json(variant, { status: 201 })
	})
}
