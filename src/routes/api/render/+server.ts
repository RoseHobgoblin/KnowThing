import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { parseWikitext } from '$lib/parser/index.js'
import { parseBody } from '$lib/server/utils.js'

const renderSchema = z.object({
	// The only parser entry point open to anonymous callers, so it needs its own
	// ceiling: BODY_SIZE_LIMIT is process-wide and was raised to 15MB for media
	// uploads, which would otherwise apply here too.
	content: z.string().max(200_000),
})

/** POST /api/render — parse wikitext, return AST JSON (for live preview) */
export const POST: RequestHandler = async ({ request }) => {
	const data = await parseBody(request, renderSchema)
	if (data instanceof Response) return data

	const ast = parseWikitext(data.content)
	return json({ ast })
}
