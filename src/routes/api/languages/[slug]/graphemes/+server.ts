import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createGraphemeSchema } from '$lib/feature/wordbook/public/server/grapheme-schema.server.js'
import { createGrapheme, listGraphemes } from '$lib/feature/wordbook/public/server/graphemes.server.js'

/** GET — list a language's graphemes with their phoneme sequences folded in. */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await listGraphemes(params.slug)))
}

/** POST — create grapheme with ordered phoneme sequence (may be empty = silent). */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, createGraphemeSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createGrapheme(event.params.slug, data), { status: 201 }))
}
