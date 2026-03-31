import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteEntryVariant } from '$lib/server/services/wordbook.js'

/** DELETE /api/wordbook/:id/variants/:variantId */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	const variantId = Number.parseInt(event.params.variantId)
	if (isNaN(entryId) || isNaN(variantId)) return json({ error: 'Invalid variant ID' }, { status: 400 })

	try {
		await deleteEntryVariant(entryId, variantId)
		return json({ success: true })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
