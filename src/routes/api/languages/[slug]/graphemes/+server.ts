import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, graphemes, graphemePhonemes, phonemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody } from '$lib/server/utils.js'
import { normalizeEnvironment, createGraphemeSchema } from '$lib/server/graphemes.js'
import { eq, and, asc, inArray, sql } from 'drizzle-orm'

async function assertPhonemesBelongToLanguage(tx: typeof db, phonemeIds: number[], languageId: number) {
	if (phonemeIds.length === 0) return true
	const rows = await tx
		.select({ id: phonemes.id })
		.from(phonemes)
		.where(and(inArray(phonemes.id, phonemeIds), eq(phonemes.languageId, languageId)))
	const foundIds = new Set(rows.map(r => r.id))
	return phonemeIds.every(id => foundIds.has(id))
}

/** GET — list a language's graphemes with their phoneme sequences folded in. */
export const GET: RequestHandler = async ({ params }) => {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const rows = await db
		.select()
		.from(graphemes)
		.where(eq(graphemes.languageId, lang.id))
		.orderBy(asc(graphemes.sortOrder), asc(graphemes.id))

	if (rows.length === 0) return json([])

	const links = await db
		.select({
			graphemeId: graphemePhonemes.graphemeId,
			position: graphemePhonemes.position,
			phonemeId: graphemePhonemes.phonemeId,
			ipa: phonemes.ipa,
			type: phonemes.type,
		})
		.from(graphemePhonemes)
		.innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
		.where(inArray(graphemePhonemes.graphemeId, rows.map(r => r.id)))
		.orderBy(asc(graphemePhonemes.graphemeId), asc(graphemePhonemes.position))

	const byId = new Map<number, { phonemeId: number, ipa: string, type: string }[]>()
	for (const l of links) {
		if (!byId.has(l.graphemeId)) byId.set(l.graphemeId, [])
		byId.get(l.graphemeId)!.push({ phonemeId: l.phonemeId, ipa: l.ipa, type: l.type })
	}

	return json(rows.map(r => ({ ...r, phonemes: byId.get(r.id) ?? [] })))
}

/** POST — create grapheme with ordered phoneme sequence (may be empty = silent). */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const data = await parseBody(event.request, createGraphemeSchema)
	if (data instanceof Response) return data

	try {
		const inserted = await db.transaction(async (tx) => {
			if (data.phonemeIds.length > 0) {
				const ok = await assertPhonemesBelongToLanguage(tx as unknown as typeof db, data.phonemeIds, lang.id)
				if (!ok) throw new Error('CROSS_LANGUAGE_PHONEME')
			}

			let sortOrder = data.sortOrder
			if (sortOrder == null) {
				const [row] = await tx.execute(sql`
					SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
					FROM graphemes
					WHERE language_id = ${lang.id}
				`) as unknown as [{ next: number }]
				sortOrder = row?.next ?? 0
			}

			const [created] = await tx
				.insert(graphemes)
				.values({
					languageId: lang.id,
					grapheme: data.grapheme,
					romanization: data.romanization?.trim() || null,
					environment: normalizeEnvironment(data.environment),
					notes: data.notes?.trim() || null,
					sortOrder,
				})
				.returning()

			if (data.phonemeIds.length > 0) {
				await tx.insert(graphemePhonemes).values(
					data.phonemeIds.map((pid, index) => ({ graphemeId: created.id, phonemeId: pid, position: index })),
				)
			}

			// Re-fetch with folded phonemes for symmetric response shape.
			const links = await tx
				.select({
					phonemeId: graphemePhonemes.phonemeId,
					position: graphemePhonemes.position,
					ipa: phonemes.ipa,
					type: phonemes.type,
				})
				.from(graphemePhonemes)
				.innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
				.where(eq(graphemePhonemes.graphemeId, created.id))
				.orderBy(asc(graphemePhonemes.position))

			return { ...created, phonemes: links.map(l => ({ phonemeId: l.phonemeId, ipa: l.ipa, type: l.type })) }
		})
		return json(inserted, { status: 201 })
	} catch (error) {
		if (error instanceof Error && error.message === 'CROSS_LANGUAGE_PHONEME') {
			return json({ error: 'One or more phonemes do not belong to this language' }, { status: 400 })
		}
		return json({ error: 'Failed to create grapheme' }, { status: 500 })
	}
}
