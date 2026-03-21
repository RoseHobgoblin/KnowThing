import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { definitions, lexicon, lexiconRevisions } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq, sql, asc } from 'drizzle-orm'

/** Helper: snapshot current entry state for revision history */
async function snapshotEntry(entryId: number, userId: number | undefined, summary: string) {
	const [entry] = await db.select().from(lexicon).where(eq(lexicon.id, entryId))
	if (!entry) return
	const defs = await db.select().from(definitions).where(eq(definitions.entryId, entryId)).orderBy(asc(definitions.senseNumber))
	await db.insert(lexiconRevisions).values({
		entryId,
		snapshot: { ...entry, definitions: defs },
		editSummary: summary,
		userId: userId || null,
	})
}

/** POST /api/wordbook/:id/definitions — add a new sense */
export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event)

	const entryId = Number.parseInt(event.params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [entry] = await db.select({ id: lexicon.id }).from(lexicon).where(eq(lexicon.id, entryId))
	if (!entry) return json({ error: 'Entry not found' }, { status: 404 })

	const body = await event.request.json()
	const { partOfSpeech, definition, usageExample, usageTranslation } = body as {
		partOfSpeech?: string
		definition: string
		usageExample?: string
		usageTranslation?: string
	}

	if (!definition?.trim()) {
		return json({ error: 'Definition is required' }, { status: 400 })
	}

	const [{ max }] = await db
		.select({ max: sql<number>`COALESCE(MAX(sense_number), 0)` })
		.from(definitions)
		.where(eq(definitions.entryId, entryId))

	const [def] = await db
		.insert(definitions)
		.values({
			entryId,
			senseNumber: Number(max) + 1,
			partOfSpeech: partOfSpeech?.trim() || null,
			definition: definition.trim(),
			usageExample: usageExample?.trim() || null,
			usageTranslation: usageTranslation?.trim() || null,
		})
		.returning()

	// Refresh search vector
	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))

	return json(def, { status: 201 })
}

/** PUT /api/wordbook/:id/definitions — bulk replace all definitions atomically */
export const PUT: RequestHandler = async (event) => {
	const user = requireAuth(event)

	const entryId = Number.parseInt(event.params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [entry] = await db.select({ id: lexicon.id }).from(lexicon).where(eq(lexicon.id, entryId))
	if (!entry) return json({ error: 'Entry not found' }, { status: 404 })

	const body = await event.request.json()
	const { defs } = body as {
		defs: Array<{ partOfSpeech?: string, definition: string, usageExample?: string, usageTranslation?: string }>
	}

	if (!defs || defs.length === 0 || !defs.some(d => d.definition?.trim())) {
		return json({ error: 'At least one definition is required' }, { status: 400 })
	}

	// Snapshot before changes
	await snapshotEntry(entryId, user.id, 'Definitions updated')

	// Delete + re-insert atomically in a transaction
	const validDefs = defs.filter(d => d.definition?.trim())
	await db.transaction(async (tx) => {
		await tx.delete(definitions).where(eq(definitions.entryId, entryId))

		for (let index = 0; index < validDefs.length; index++) {
			const d = validDefs[index]
			await tx.insert(definitions).values({
				entryId,
				senseNumber: index + 1,
				partOfSpeech: d.partOfSpeech?.trim() || null,
				definition: d.definition.trim(),
				usageExample: d.usageExample?.trim() || null,
				usageTranslation: d.usageTranslation?.trim() || null,
			})
		}

		// Refresh search vector inside transaction
		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	})

	return json({ success: true, count: validDefs.length })
}
