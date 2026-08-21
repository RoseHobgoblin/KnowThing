import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteSector, updateSector } from '$lib/feature/rodder/public/server/sectors.server.js'
import { resolveRodderSectorDocument } from '$lib/feature/rodder/public/server/documents.server.js'

/** GET /api/rodder/sectors/[slug] — one sector's frame contract and roots. */
export const GET: RequestHandler = async ({ params, url }) => {
	return handleServiceCall(async () => {
		const document = await resolveRodderSectorDocument(params.slug)
		if (!document) return json({ error: 'Sector not found' }, { status: 404 })
		return json(document, url.searchParams.get('download') === '1'
			? { headers: { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${document.identity.slug}.sector.json`)}` } }
			: undefined)
	})
}

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	let raw: unknown
	try {
		raw = await event.request.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 })
	}
	return handleServiceCall(async () => json(await updateSector(event.params.slug, raw)))
}

export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteSector(event.params.slug)))
}
