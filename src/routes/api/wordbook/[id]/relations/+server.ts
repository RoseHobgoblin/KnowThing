import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/server/wordbook/etymology.js'
import { addEntryRelation } from '$lib/server/services/wordbook.js'

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
	requireRole(event, 'editor')

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { targetId, relationType, notes } = body as {
		targetId: number
		relationType: string
		notes?: string
	}

	try {
		const relation = await addEntryRelation(id, { targetId, relationType, notes })
		return json(relation, { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
