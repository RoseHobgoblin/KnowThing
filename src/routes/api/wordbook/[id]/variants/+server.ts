import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { addEntryVariant, listEntryVariants } from '$lib/feature/wordbook/server/service.server.js'
import { addVariantSchema } from '$lib/feature/wordbook/server/schemas.server.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (Number.isNaN(id)) return null
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
	const user = requireRole(event, 'editor')
	const entryId = parseId(event.params.id)
	if (entryId == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, addVariantSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const variant = await addEntryVariant(entryId, data, user.id)
		return json(variant, { status: 201 })
	})
}
