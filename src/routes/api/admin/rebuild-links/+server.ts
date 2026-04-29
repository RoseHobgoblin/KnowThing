import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { rebuildAllContentLinks } from '$lib/server/services/admin.js'

/** POST /api/admin/rebuild-links — rebuild contentLinks for all content records */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return json(await rebuildAllContentLinks())
}
