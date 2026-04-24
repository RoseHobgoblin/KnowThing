import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, phonemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody } from '$lib/server/utils.js'
import { eq, and, asc, sql } from 'drizzle-orm'

const PHONEME_TYPES = ['consonant', 'vowel', 'diphthong', 'special'] as const

const createPhonemeSchema = z.object({
	ipa: z.string().min(1, 'IPA is required'),
	type: z.enum(PHONEME_TYPES),
	place: z.string().nullish(),
	manner: z.string().nullish(),
	subtype: z.string().nullish(),
	voicing: z.enum(['voiced', 'voiceless']).nullish(),
	height: z.string().nullish(),
	backness: z.string().nullish(),
	rounded: z.boolean().nullish(),
	notes: z.string().nullish(),
	sortOrder: z.number().int().nullish(),
})

/** GET /api/languages/:slug/phonemes — list a language's phoneme inventory. */
export const GET: RequestHandler = async ({ params, url }) => {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const typeFilter = url.searchParams.get('type')
	const conditions = [eq(phonemes.languageId, lang.id)]
	if (typeFilter && (PHONEME_TYPES as readonly string[]).includes(typeFilter)) {
		conditions.push(eq(phonemes.type, typeFilter))
	}

	const rows = await db
		.select()
		.from(phonemes)
		.where(and(...conditions))
		.orderBy(asc(phonemes.type), asc(phonemes.sortOrder), asc(phonemes.id))

	return json(rows)
}

/** POST /api/languages/:slug/phonemes — add a phoneme. */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const data = await parseBody(event.request, createPhonemeSchema)
	if (data instanceof Response) return data

	try {
		const inserted = await db.transaction(async (tx) => {
			// Default sort_order to (max + 1) within the same type for this language.
			let sortOrder = data.sortOrder
			if (sortOrder == null) {
				const [row] = await tx.execute(sql`
					SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
					FROM phonemes
					WHERE language_id = ${lang.id} AND type = ${data.type}
				`) as unknown as [{ next: number }]
				sortOrder = row?.next ?? 0
			}

			const [row] = await tx
				.insert(phonemes)
				.values({
					languageId: lang.id,
					ipa: data.ipa.trim(),
					type: data.type,
					place: data.place?.trim() || null,
					manner: data.manner?.trim() || null,
					subtype: data.subtype?.trim() || null,
					voicing: data.voicing ?? null,
					height: data.height?.trim() || null,
					backness: data.backness?.trim() || null,
					rounded: data.rounded ?? null,
					notes: data.notes?.trim() || null,
					sortOrder,
				})
				.returning()
			return row
		})
		return json(inserted, { status: 201 })
	} catch {
		return json({ error: 'Failed to create phoneme' }, { status: 500 })
	}
}
