import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { computeCognates, getDirectRelations, getEtymologyChain } from '$lib/feature/wordbook/public/server/etymology.server.js'
import { addEntryRelation } from '$lib/feature/wordbook/public/server/relations.server.js'
import { getEntryLanguageId } from '$lib/feature/wordbook/public/server/entries.server.js'
import { addRelationSchema } from '$lib/feature/wordbook/public/server/schemas.server.js'
import { handleServiceCall, parseBody } from '$lib/server/utils.js'

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (Number.isNaN(id)) return null
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
	const user = requireRole(event, 'editor')
	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, addRelationSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const relation = await addEntryRelation(id, data, user.id)
		return json(relation, { status: 201 })
	})
}
