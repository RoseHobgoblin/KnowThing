import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import {
	deleteWordbookEntry,
	getWordbookEntry,
	updateWordbookEntry,
} from '$lib/server/services/wordbook.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'

const updateWordSchema = z.object({
	word: z.string().optional(),
	languageId: z.number().optional(),
	pronunciation: z.string().optional(),
	etymology: z.string().optional(),
	notes: z.string().optional(),
	pageSlug: z.string().optional(),
	tags: z.array(z.string()).optional(),
})

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (isNaN(id)) return null
	return id
}

/** GET /api/wordbook/:id — single entry with all definitions */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await getWordbookEntry(id)))
}

/** PUT /api/wordbook/:id — update headword fields only */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, updateWordSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateWordbookEntry(id, data, user.id)))
}

/** DELETE /api/wordbook/:id — delete entire entry */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await deleteWordbookEntry(id)))
}
