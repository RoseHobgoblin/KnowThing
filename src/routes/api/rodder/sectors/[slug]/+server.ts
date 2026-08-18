import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteSector, getSectorBySlug, updateSector } from '$lib/server/services/celestial-sectors.js'

/** GET /api/celestial/sectors/[slug] — one sector's frame contract and roots. */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getSectorBySlug(params.slug)))
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
