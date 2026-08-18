import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { listSectorsForRegistry } from '$lib/server/services/celestial-sectors.js'

/** GET /api/celestial/sectors — list sectors with root counts. Read-only: sector authoring is post-Part-1. */
export const GET: RequestHandler = async () => {
	return handleServiceCall(async () => json(await listSectorsForRegistry()))
}
