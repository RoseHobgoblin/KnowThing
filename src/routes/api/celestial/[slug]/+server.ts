import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { deleteCelestial, getCelestialBySlug, updateCelestial } from '$lib/server/services/celestial-bodies.js'

/** GET /api/celestial/:slug */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getCelestialBySlug(params.slug)))
}

/**
 * PUT /api/celestial/:slug
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

	return handleServiceCall(async () => json(await updateCelestial(event.params.slug, raw)))
}

/** DELETE /api/celestial/:slug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteCelestial(event.params.slug)))
}
