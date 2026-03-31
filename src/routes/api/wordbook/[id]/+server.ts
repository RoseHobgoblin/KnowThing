import { isHttpError, json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, asc } from 'drizzle-orm'
import { updateWordbookEntry } from '$lib/server/services/wordbook.js'

const updateWordSchema = z.object({
	word: z.string().optional(),
	languageId: z.number().optional(),
	pronunciation: z.string().optional(),
	etymology: z.string().optional(),
	notes: z.string().optional(),
	pageSlug: z.string().optional(),
	tags: z.array(z.string()).optional(),
})

/** GET /api/wordbook/:id — single entry with all definitions */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number.parseInt(params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [entry] = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			etymology: lexicon.etymology,
			notes: lexicon.notes,
			pageSlug: lexicon.pageSlug,
			tags: lexicon.tags,
			createdAt: lexicon.createdAt,
			updatedAt: lexicon.updatedAt,
			languageId: lexicon.languageId,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexicon.id, id))

	if (!entry) return json({ error: 'Entry not found' }, { status: 404 })

	const defs = await db
		.select()
		.from(definitions)
		.where(eq(definitions.entryId, id))
		.orderBy(asc(definitions.senseNumber))

	return json({ ...entry, definitions: defs })
}

/** PUT /api/wordbook/:id — update headword fields only */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const parsed = updateWordSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	try {
		const updated = await updateWordbookEntry(id, parsed.data, user.id)
		return json(updated)
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}

/** DELETE /api/wordbook/:id — delete entire entry */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [deleted] = await db.delete(lexicon).where(eq(lexicon.id, id)).returning()
	if (!deleted) return json({ error: 'Entry not found' }, { status: 404 })
	return json({ success: true })
}
