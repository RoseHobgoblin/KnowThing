import { error } from '@sveltejs/kit'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { graphemePhonemes, graphemes, languages, phonemes } from '$lib/server/db/schema.js'
import { normalizeAxis } from '$lib/server/utils.js'
import {
	type createPhonemeSchema,
	PHONEME_TYPES,
	type updatePhonemeSchema,
} from '$lib/server/http/languages/schemas.js'

type CreatePhonemeInput = z.infer<typeof createPhonemeSchema>
type UpdatePhonemeInput = z.infer<typeof updatePhonemeSchema>

async function assertLanguage(slug: string) {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) throw error(404, 'Language not found')
	return lang
}

async function assertPhonemeInLanguage(languageId: number, phonemeId: number) {
	const [row] = await db
		.select()
		.from(phonemes)
		.where(and(eq(phonemes.id, phonemeId), eq(phonemes.languageId, languageId)))
	if (!row) throw error(404, 'Phoneme not found')
	return row
}

export async function listPhonemes(slug: string, typeFilter: string | null) {
	const lang = await assertLanguage(slug)

	const conditions = [eq(phonemes.languageId, lang.id)]
	if (typeFilter && (PHONEME_TYPES as readonly string[]).includes(typeFilter)) {
		conditions.push(eq(phonemes.type, typeFilter))
	}

	return db
		.select()
		.from(phonemes)
		.where(and(...conditions))
		.orderBy(asc(phonemes.type), asc(phonemes.sortOrder), asc(phonemes.id))
}

export async function getPhoneme(slug: string, phonemeId: number) {
	const lang = await assertLanguage(slug)
	const row = await assertPhonemeInLanguage(lang.id, phonemeId)

	const linkedGraphemes = await db
		.selectDistinct({
			id: graphemes.id,
			grapheme: graphemes.grapheme,
			environment: graphemes.environment,
			sortOrder: graphemes.sortOrder,
		})
		.from(graphemePhonemes)
		.innerJoin(graphemes, eq(graphemePhonemes.graphemeId, graphemes.id))
		.where(eq(graphemePhonemes.phonemeId, phonemeId))
		.orderBy(asc(graphemes.sortOrder), asc(graphemes.id))

	return { ...row, graphemes: linkedGraphemes }
}

export async function createPhoneme(slug: string, data: CreatePhonemeInput) {
	const lang = await assertLanguage(slug)

	return db.transaction(async (tx) => {
		let sortOrder = data.sortOrder
		if (sortOrder == null) {
			const [row] = await tx.execute(sql`
				SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
				FROM phonemes
				WHERE language_id = ${lang.id} AND type = ${data.type}
			`) as unknown as [{ next: number }]
			sortOrder = row?.next ?? 0
		}

		const [created] = await tx
			.insert(phonemes)
			.values({
				languageId: lang.id,
				ipa: data.ipa.trim(),
				type: data.type,
				place: normalizeAxis(data.place),
				manner: normalizeAxis(data.manner),
				subtype: normalizeAxis(data.subtype),
				voicing: data.voicing ?? null,
				height: normalizeAxis(data.height),
				backness: normalizeAxis(data.backness),
				rounded: data.rounded ?? null,
				marginal: data.marginal ?? false,
				notes: data.notes?.trim() || null,
				sortOrder,
			})
			.returning()
		return created
	})
}

export async function updatePhoneme(slug: string, phonemeId: number, data: UpdatePhonemeInput) {
	const lang = await assertLanguage(slug)
	await assertPhonemeInLanguage(lang.id, phonemeId)

	const updates: Partial<typeof phonemes.$inferInsert> = { updatedAt: new Date() }
	if (data.ipa !== undefined) updates.ipa = data.ipa.trim()
	if (data.type !== undefined) updates.type = data.type
	if (data.place !== undefined) updates.place = normalizeAxis(data.place)
	if (data.manner !== undefined) updates.manner = normalizeAxis(data.manner)
	if (data.subtype !== undefined) updates.subtype = normalizeAxis(data.subtype)
	if (data.voicing !== undefined) updates.voicing = data.voicing ?? null
	if (data.height !== undefined) updates.height = normalizeAxis(data.height)
	if (data.backness !== undefined) updates.backness = normalizeAxis(data.backness)
	if (data.rounded !== undefined) updates.rounded = data.rounded ?? null
	if (data.marginal !== undefined) updates.marginal = data.marginal ?? false
	if (data.notes !== undefined) updates.notes = data.notes?.trim() || null
	if (data.sortOrder !== undefined && data.sortOrder !== null) updates.sortOrder = data.sortOrder

	const [updated] = await db.update(phonemes).set(updates).where(eq(phonemes.id, phonemeId)).returning()
	return updated
}

export async function deletePhoneme(slug: string, phonemeId: number) {
	const lang = await assertLanguage(slug)
	await assertPhonemeInLanguage(lang.id, phonemeId)

	const [countRow] = await db.execute(sql`
		SELECT COUNT(DISTINCT grapheme_id)::int AS n
		FROM grapheme_phonemes
		WHERE phoneme_id = ${phonemeId}
	`) as unknown as [{ n: number }]
	const affectedGraphemes = countRow?.n ?? 0

	await db.delete(phonemes).where(eq(phonemes.id, phonemeId))
	return { ok: true, affectedGraphemes }
}
