import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { listWordbookTags } from '$lib/feature/wordbook/server/service.server.js'

/** GET /api/wordbook/tags — list all unique tags with counts */
export const GET: RequestHandler = async () => {
	return json(await listWordbookTags())
}
