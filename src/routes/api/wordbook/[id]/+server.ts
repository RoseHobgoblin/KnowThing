import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, lexiconRevisions, languages } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq, asc } from 'drizzle-orm'

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
	const user = requireAuth(event)
	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	// Snapshot before changes
	const [current] = await db.select().from(lexicon).where(eq(lexicon.id, id))
	if (!current) return json({ error: 'Entry not found' }, { status: 404 })
	const currentDefs = await db.select().from(definitions).where(eq(definitions.entryId, id)).orderBy(asc(definitions.senseNumber))
	await db.insert(lexiconRevisions).values({
		entryId: id,
		snapshot: { ...current, definitions: currentDefs },
		editSummary: 'Headword updated',
		userId: user.id,
	})

	const body = await event.request.json()
	const parsed = updateWordSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const { word, languageId, pronunciation, etymology, notes, pageSlug, tags } = parsed.data

	// Normalize tags
	const normalizedTags = tags
		? tags.map(t => t.trim().toLowerCase()).filter((t, index, a) => t && a.indexOf(t) === index)
		: undefined

	const [updated] = await db
		.update(lexicon)
		.set({
			...(word && { word: word.trim() }),
			...(languageId && { languageId }),
			...(pronunciation !== undefined && { pronunciation: pronunciation?.trim() || null }),
			...(etymology !== undefined && { etymology: etymology?.trim() || null }),
			...(notes !== undefined && { notes: notes?.trim() || null }),
			...(pageSlug !== undefined && { pageSlug: pageSlug?.trim() || null }),
			...(normalizedTags && { tags: normalizedTags }),
			updatedAt: new Date(),
		})
		.where(eq(lexicon.id, id))
		.returning()

	return json(updated)
}

/** DELETE /api/wordbook/:id — delete entire entry */
export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event)
	if (user.role !== 'admin') {
		return json({ error: 'Admin access required' }, { status: 403 })
	}

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [deleted] = await db.delete(lexicon).where(eq(lexicon.id, id)).returning()
	if (!deleted) return json({ error: 'Entry not found' }, { status: 404 })
	return json({ success: true })
}
