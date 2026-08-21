import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createWordbookEntry } from '$lib/feature/wordbook/public/server/entries.server.js'
import { searchWordbookEntries } from '$lib/feature/wordbook/public/server/search.server.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createWordSchema } from '$lib/feature/wordbook/public/server/schemas.server.js'

/** GET /api/wordbook — search and browse */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	const language = url.searchParams.get('language') || undefined
	const tag = url.searchParams.get('tag') || undefined
	const letter = url.searchParams.get('letter') || undefined
	const pos = url.searchParams.get('pos') || undefined
	const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '50'), 200)
	const offset = Number.parseInt(url.searchParams.get('offset') || '0')

	return json(await searchWordbookEntries({ query: q, language, tag, letter, pos, limit, offset }))
}

/** POST /api/wordbook — create entry with definitions */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const data = await parseBody(event.request, createWordSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const entry = await createWordbookEntry({ ...data, userId: user.id })
		return json(entry, { status: 201 })
	})
}
