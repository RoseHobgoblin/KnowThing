import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createWordbookEntry } from '$lib/server/services/wordbook.js'
import { searchWordbookEntries } from '$lib/server/services/search/wordbook.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'

const createWordSchema = z.object({
	word: z.string().min(1, 'Word is required'),
	languageId: z.number({ error: 'Language is required' }),
	pronunciation: z.string().optional(),
	etymology: z.string().optional(),
	notes: z.string().optional(),
	pageSlug: z.string().optional(),
	tags: z.array(z.string()).optional(),
	defs: z.array(z.object({
		partOfSpeech: z.string().optional(),
		definition: z.string(),
		usageExample: z.string().optional(),
		usageTranslation: z.string().optional(),
	})).optional(),
	relations: z.array(z.object({
		targetId: z.number(),
		relationType: z.string(),
	})).optional(),
	definition: z.string().optional(),
	isHomograph: z.boolean().optional(),
})

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
