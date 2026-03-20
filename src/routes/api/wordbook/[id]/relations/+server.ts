import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, lexiconRelations, languages } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/server/wordbook/etymology.js'

const VALID_TYPES = ['derived_from', 'loan_from', 'compound_of']

/** GET /api/wordbook/:id/relations — full relations + computed cognates */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number.parseInt(params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	// Get the entry's language for cognate grouping
	const [entry] = await db
		.select({ languageId: lexicon.languageId })
		.from(lexicon)
		.where(eq(lexicon.id, id))

	if (!entry) {
		return json({ error: 'Entry not found' }, { status: 404 })
	}

	const [direct, cognates, etymologyChain] = await Promise.all([
		getDirectRelations(id),
		computeCognates(id, entry.languageId),
		getEtymologyChain(id),
	])

	return json({ direct, cognates, etymologyChain })
}

/** POST /api/wordbook/:id/relations — add a relation */
export const POST: RequestHandler = async (event) => {
	requireAuth(event)

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { targetId, relationType, notes } = body as {
		targetId: number
		relationType: string
		notes?: string
	}

	if (!targetId || !relationType) {
		return json({ error: 'targetId and relationType are required' }, { status: 400 })
	}

	if (!VALID_TYPES.includes(relationType)) {
		return json({ error: `Invalid relation type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
	}

	if (targetId === id) {
		return json({ error: 'Cannot relate an entry to itself' }, { status: 400 })
	}

	// Verify target exists
	const [target] = await db.select({ id: lexicon.id }).from(lexicon).where(eq(lexicon.id, targetId))
	if (!target) {
		return json({ error: 'Target entry not found' }, { status: 404 })
	}

	const [relation] = await db
		.insert(lexiconRelations)
		.values({
			sourceId: id,
			targetId,
			relationType,
			notes: notes?.trim() || null,
		})
		.returning()

	return json(relation, { status: 201 })
}
