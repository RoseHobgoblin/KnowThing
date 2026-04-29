import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createPhonemeSchema } from '$lib/server/http/languages/schemas.js'
import { createPhoneme, listPhonemes } from '$lib/server/services/phonemes.js'

/** GET /api/languages/:slug/phonemes — list a language's phoneme inventory. */
export const GET: RequestHandler = async ({ params, url }) => {
	return handleServiceCall(async () =>
		json(await listPhonemes(params.slug, url.searchParams.get('type'))),
	)
}

/** POST /api/languages/:slug/phonemes — add a phoneme. */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, createPhonemeSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createPhoneme(event.params.slug, data), { status: 201 }))
}
