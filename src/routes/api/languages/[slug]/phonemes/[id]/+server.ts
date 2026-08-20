import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updatePhonemeSchema } from '$lib/feature/wordbook/server/language-schemas.server.js'
import { deletePhoneme, getPhoneme, updatePhoneme } from '$lib/feature/wordbook/server/phonemes.server.js'

function parseId(raw: string) {
	const id = Number(raw)
	if (!Number.isInteger(id)) return null
	return id
}

/** GET /api/languages/:slug/phonemes/:id */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params.id)
	if (id == null) return json({ error: 'Invalid id' }, { status: 400 })

	return handleServiceCall(async () => json(await getPhoneme(params.slug, id)))
}

/** PATCH /api/languages/:slug/phonemes/:id */
export const PATCH: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid id' }, { status: 400 })

	const data = await parseBody(event.request, updatePhonemeSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updatePhoneme(event.params.slug, id, data)))
}

/** DELETE /api/languages/:slug/phonemes/:id
 * Returns affectedGraphemes — the count of graphemes that had at least one
 * link to this phoneme. The editor surfaces this to the user so "N graphemes
 * became silent" can be shown in the undo toast. */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid id' }, { status: 400 })

	return handleServiceCall(async () => json(await deletePhoneme(event.params.slug, id)))
}
