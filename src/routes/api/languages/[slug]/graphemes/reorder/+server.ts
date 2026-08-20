import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { reorderGraphemes } from '$lib/feature/wordbook/server/graphemes.server.js'

const reorderSchema = z.object({
	order: z.array(z.number().int()),
})

/** POST /api/languages/:slug/graphemes/reorder — bulk sort_order update.
 * The `order` array must cover exactly the language's graphemes. */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, reorderSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await reorderGraphemes(event.params.slug, data.order)))
}
