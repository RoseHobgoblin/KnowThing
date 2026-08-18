import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { requireRole } from '$lib/server/auth.js'
import { createSector, listSectorsForRegistry } from '$lib/server/services/rodder-sectors.js'

/** GET /api/rodder/sectors — list sectors with root counts and frame contracts. */
export const GET: RequestHandler = async () => {
	return handleServiceCall(async () => json(await listSectorsForRegistry()))
}

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	let raw: unknown
	try {
		raw = await event.request.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 })
	}
	return handleServiceCall(async () => json(await createSector(raw), { status: 201 }))
}
