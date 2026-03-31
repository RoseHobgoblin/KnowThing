import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { parseWikitext } from '$lib/parser/index.js'

const renderSchema = z.object({
	content: z.string(),
})

/** POST /api/render — parse wikitext, return AST JSON (for live preview) */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json()
	const parsed = renderSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const ast = parseWikitext(parsed.data.content)
	return json({ ast })
}
