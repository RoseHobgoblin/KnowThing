import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { parseWikitext } from '$lib/parser/index.js'

/** POST /api/render — parse wikitext, return AST JSON (for live preview) */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json()
	const { content } = body as { content: string }

	if (typeof content !== 'string') {
		return json({ error: 'content is required' }, { status: 400 })
	}

	const ast = parseWikitext(content)
	return json({ ast })
}
