import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexiconVariants, languageDialects } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { addEntryVariant } from '$lib/server/services/wordbook.js'

/** GET /api/wordbook/:id/variants */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = Number.parseInt(params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const variants = await db
		.select({
			id: lexiconVariants.id,
			pronunciation: lexiconVariants.pronunciation,
			spelling: lexiconVariants.spelling,
			notes: lexiconVariants.notes,
			dialectId: lexiconVariants.dialectId,
			dialectName: languageDialects.name,
			dialectSlug: languageDialects.slug,
			dialectRegion: languageDialects.region,
		})
		.from(lexiconVariants)
		.innerJoin(languageDialects, eq(lexiconVariants.dialectId, languageDialects.id))
		.where(eq(lexiconVariants.entryId, entryId))

	return json(variants)
}

/** POST /api/wordbook/:id/variants */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const entryId = Number.parseInt(event.params.id)
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { dialectId, pronunciation, spelling, notes } = body as {
		dialectId: number
		pronunciation?: string
		spelling?: string
		notes?: string
	}

	if (!dialectId) return json({ error: 'dialectId is required' }, { status: 400 })
	if (!pronunciation?.trim() && !spelling?.trim()) {
		return json({ error: 'At least pronunciation or spelling is required' }, { status: 400 })
	}

	try {
		const variant = await addEntryVariant(entryId, { dialectId, pronunciation, spelling, notes })
		return json(variant, { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
