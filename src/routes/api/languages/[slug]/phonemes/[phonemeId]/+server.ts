import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { phonemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** PUT /api/languages/:slug/phonemes/:phonemeId — update a phoneme */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = Number(event.params.phonemeId)
	if (Number.isNaN(id)) return json({ error: 'Invalid phoneme ID' }, { status: 400 })

	const body = await event.request.json()
	const { ipa, type, place, manner, subtype, voicing, height, backness, rounded, notes, sortOrder } = body as {
		ipa?: string
		type?: string
		place?: string | null
		manner?: string | null
		subtype?: string | null
		voicing?: string | null
		height?: string | null
		backness?: string | null
		rounded?: boolean
		notes?: string | null
		sortOrder?: number
	}

	const update: Record<string, unknown> = {}
	if (ipa !== undefined) update.ipa = ipa.trim()
	if (type !== undefined) update.type = type.trim()
	if (place !== undefined) update.place = place?.trim() || null
	if (manner !== undefined) update.manner = manner?.trim() || null
	if (subtype !== undefined) update.subtype = subtype?.trim() || null
	if (voicing !== undefined) update.voicing = voicing?.trim() || null
	if (height !== undefined) update.height = height?.trim() || null
	if (backness !== undefined) update.backness = backness?.trim() || null
	if (rounded !== undefined) update.rounded = rounded
	if (notes !== undefined) update.notes = notes?.trim() || null
	if (sortOrder !== undefined) update.sortOrder = sortOrder

	const [row] = await db.update(phonemes).set(update).where(eq(phonemes.id, id)).returning()
	if (!row) return json({ error: 'Phoneme not found' }, { status: 404 })

	return json(row)
}

/** DELETE /api/languages/:slug/phonemes/:phonemeId — delete a phoneme */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = Number(event.params.phonemeId)
	if (Number.isNaN(id)) return json({ error: 'Invalid phoneme ID' }, { status: 400 })

	const [row] = await db.delete(phonemes).where(eq(phonemes.id, id)).returning()
	if (!row) return json({ error: 'Phoneme not found' }, { status: 404 })

	return new Response(null, { status: 204 })
}
