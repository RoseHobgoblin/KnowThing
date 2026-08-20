import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { deleteRodder, updateRodder } from '$lib/feature/rodder/server/bodies.server.js'
import { resolveRodderEntityDocument } from '$lib/feature/rodder/server/documents.server.js'

/** GET /api/rodder/:slug */
export const GET: RequestHandler = async ({ params, url }) => {
	return handleServiceCall(async () => {
		const document = await resolveRodderEntityDocument(params.slug)
		if (!document) return json({ error: 'Rodder entity not found' }, { status: 404 })
		return json(document, url.searchParams.get('download') === '1'
			? { headers: { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${document.identity.slug}.rodder.json`)}` } }
			: undefined)
	})
}

/**
 * PUT /api/rodder/:slug
 * Validation happens inside the service: the row's kind picks the Zod schema,
 * and the kind is only known once the row is loaded.
 */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	let raw: unknown
	try {
		raw = await event.request.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	return handleServiceCall(async () => json(await updateRodder(event.params.slug, raw)))
}

/** DELETE /api/rodder/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteRodder(event.params.slug)))
}
