import type { PageServerLoad } from './$types.js'
import { getSectorBySlug } from '$lib/server/services/rodder-sectors.js'

/** Read-only sector view: one sector's frame contract and its roots. */
export const load: PageServerLoad = async ({ params }) => {
	return await getSectorBySlug(params.slug)
}
