import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, phonemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, asc } from 'drizzle-orm'

/** GET /api/languages/:slug/phonemes — list all phonemes for a language */
export const GET: RequestHandler = async ({ params }) => {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const rows = await db
		.select()
		.from(phonemes)
		.where(eq(phonemes.languageId, lang.id))
		.orderBy(asc(phonemes.type), asc(phonemes.sortOrder))

	return json(rows)
}

/** POST /api/languages/:slug/phonemes — add a phoneme */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const body = await event.request.json()
	const { ipa, type, place, manner, subtype, voicing, height, backness, rounded, notes, sortOrder } = body as {
		ipa: string
		type: string
		place?: string
		manner?: string
		subtype?: string
		voicing?: string
		height?: string
		backness?: string
		rounded?: boolean
		notes?: string
		sortOrder?: number
	}

	if (!ipa?.trim() || !type?.trim()) {
		return json({ error: 'ipa and type are required' }, { status: 400 })
	}

	const [row] = await db
		.insert(phonemes)
		.values({
			languageId: lang.id,
			ipa: ipa.trim(),
			type: type.trim(),
			place: place?.trim() || null,
			manner: manner?.trim() || null,
			subtype: subtype?.trim() || null,
			voicing: voicing?.trim() || null,
			height: height?.trim() || null,
			backness: backness?.trim() || null,
			rounded: rounded ?? false,
			notes: notes?.trim() || null,
			sortOrder: sortOrder ?? 0,
		})
		.returning()

	return json(row, { status: 201 })
}
