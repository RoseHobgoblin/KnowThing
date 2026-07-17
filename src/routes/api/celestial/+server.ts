import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { CREATE_SCHEMAS, celestialKindSchema } from '$lib/celestial/schema.js'
import { isCelestialKind } from '$lib/celestial/parent-rules.js'
import { parseInput, handleServiceCall } from '$lib/server/utils.js'
import { createCelestial, listCelestial } from '$lib/server/services/celestial-bodies.js'

/** GET /api/celestial?kind=system|star|body&star=<slug> — list celestial entities */
export const GET: RequestHandler = async ({ url }) => {
	const kindParameter = url.searchParams.get('kind')
	if (kindParameter !== null && !isCelestialKind(kindParameter)) {
		return json({ error: 'kind must be one of: system, star, body' }, { status: 400 })
	}
	return handleServiceCall(async () => json(await listCelestial({
		kind: kindParameter ?? undefined,
		starSlug: url.searchParams.get('star'),
	})))
}

/** POST /api/celestial — create a celestial entity; body carries the kind discriminator */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	let raw: unknown
	try {
		raw = await event.request.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	const kindParsed = parseInput(raw, celestialKindSchema)
	if (kindParsed instanceof Response) return kindParsed

	const data = parseInput(raw, CREATE_SCHEMAS[kindParsed.kind])
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const created = await createCelestial(kindParsed.kind, data)
		return json(created, { status: 201 })
	})
}
