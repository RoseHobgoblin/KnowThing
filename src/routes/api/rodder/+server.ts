import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { CREATE_SCHEMAS, rodderKindSchema } from '$lib/feature/rodder/schema.js'
import { isRodderKind } from '$lib/feature/rodder/parent-rules.js'
import { parseInput, handleServiceCall } from '$lib/server/utils.js'
import { createRodder, listRodder } from '$lib/feature/rodder/server/bodies.server.js'

/** GET /api/rodder?kind=system|star|body&star=<slug> — list rodder entities */
export const GET: RequestHandler = async ({ url }) => {
	const kindParameter = url.searchParams.get('kind')
	if (kindParameter !== null && !isRodderKind(kindParameter)) {
		return json({ error: 'kind must be one of: system, star, body' }, { status: 400 })
	}
	return handleServiceCall(async () => json(await listRodder({
		kind: kindParameter ?? undefined,
		starSlug: url.searchParams.get('star'),
	})))
}

/** POST /api/rodder — create a rodder entity; body carries the kind discriminator */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	let raw: unknown
	try {
		raw = await event.request.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	const kindParsed = parseInput(raw, rodderKindSchema)
	if (kindParsed instanceof Response) return kindParsed

	const data = parseInput(raw, CREATE_SCHEMAS[kindParsed.kind])
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const created = await createRodder(kindParsed.kind, data)
		return json(created, { status: 201 })
	})
}
