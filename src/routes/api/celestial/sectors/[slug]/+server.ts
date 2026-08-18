import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { getSectorBySlug } from '$lib/server/services/celestial-sectors.js'

/** GET /api/celestial/sectors/[slug] — one sector's frame contract and roots. */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getSectorBySlug(params.slug)))
}
