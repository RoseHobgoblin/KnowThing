import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { computeCognates, getDirectRelations, getEtymologyChain } from '$lib/server/wordbook/etymology.js'
import { addEntryRelation, getEntryLanguageId } from '$lib/server/services/wordbook.js'
import { handleServiceCall } from '$lib/server/utils.js'

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (isNaN(id)) return null
	return id
}

/** GET /api/wordbook/:id/relations — full relations + computed cognates */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => {
		const languageId = await getEntryLanguageId(id)
		const [direct, cognates, etymologyChain] = await Promise.all([
			getDirectRelations(id),
			computeCognates(id, languageId),
			getEtymologyChain(id),
		])
		return json({ direct, cognates, etymologyChain })
	})
}

/** POST /api/wordbook/:id/relations — add a relation */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { targetId, relationType, notes } = body as {
		targetId: number
		relationType: string
		notes?: string
	}

	return handleServiceCall(async () => {
		const relation = await addEntryRelation(id, { targetId, relationType, notes })
		return json(relation, { status: 201 })
	})
}
