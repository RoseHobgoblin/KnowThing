import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteEntryVariant } from '$lib/feature/wordbook/server/service.server.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** DELETE /api/wordbook/:id/variants/:variantId */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const variantId = Number.parseInt(event.params.variantId)
	if (Number.isNaN(entryId) || Number.isNaN(variantId)) return json({ error: 'Invalid variant ID' }, { status: 400 })

	return handleServiceCall(async () => {
		await deleteEntryVariant(entryId, variantId, user.id)
		return json({ success: true })
	})
}
