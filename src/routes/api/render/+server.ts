import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { parseWikitext } from '$lib/parser/index.js'
import { parseBody } from '$lib/server/utils.js'

const renderSchema = z.object({
	content: z.string(),
})

/** POST /api/render — parse wikitext, return AST JSON (for live preview) */
export const POST: RequestHandler = async ({ request }) => {
	const data = await parseBody(request, renderSchema)
	if (data instanceof Response) return data

	const ast = parseWikitext(data.content)
	return json({ ast })
}
