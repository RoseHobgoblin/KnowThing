import { error } from '@sveltejs/kit'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { graphemePhonemes, graphemes, languages, phonemes } from '$lib/server/db/schema.js'
import {
	createGraphemeSchema,
	normalizeEnvironment,
	validateReorderPayload,
} from '$lib/feature/wordbook/server/grapheme-schema.server.js'
import type { updateGraphemeSchema } from '$lib/feature/wordbook/server/language-schemas.server.js'

type CreateGraphemeInput = z.infer<typeof createGraphemeSchema>
type UpdateGraphemeInput = z.infer<typeof updateGraphemeSchema>

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Db = typeof db | Tx

async function assertLanguage(slug: string) {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) throw error(404, 'Language not found')
	return lang
}

async function assertGraphemeInLanguage(languageId: number, graphemeId: number) {
	const [row] = await db
		.select()
		.from(graphemes)
		.where(and(eq(graphemes.id, graphemeId), eq(graphemes.languageId, languageId)))
	if (!row) throw error(404, 'Grapheme not found')
	return row
}

async function assertPhonemesBelongToLanguage(database: Db, phonemeIds: number[], languageId: number) {
	if (phonemeIds.length === 0) return
	const rows = await database
		.select({ id: phonemes.id })
		.from(phonemes)
		.where(and(inArray(phonemes.id, phonemeIds), eq(phonemes.languageId, languageId)))
	const found = new Set(rows.map(r => r.id))
	if (!phonemeIds.every(id => found.has(id))) {
		throw error(400, 'One or more phonemes do not belong to this language')
	}
}

async function loadFoldedPhonemes(database: Db, graphemeId: number) {
	const links = await database
		.select({
			phonemeId: graphemePhonemes.phonemeId,
			position: graphemePhonemes.position,
			ipa: phonemes.ipa,
			type: phonemes.type,
		})
		.from(graphemePhonemes)
		.innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
		.where(eq(graphemePhonemes.graphemeId, graphemeId))
		.orderBy(asc(graphemePhonemes.position))

	return links.map(l => ({ phonemeId: l.phonemeId, ipa: l.ipa, type: l.type }))
}

export async function listGraphemes(slug: string) {
	const lang = await assertLanguage(slug)
	return listGraphemesByLanguageId(lang.id)
}

export async function listGraphemesByLanguageId(languageId: number) {
	const rows = await db
		.select()
		.from(graphemes)
		.where(eq(graphemes.languageId, languageId))
		.orderBy(asc(graphemes.sortOrder), asc(graphemes.id))

	if (rows.length === 0) return []

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

	return rows.map(r => ({ ...r, phonemes: byId.get(r.id) ?? [] }))
}

export async function createGrapheme(slug: string, data: CreateGraphemeInput) {
	const lang = await assertLanguage(slug)

	return db.transaction(async (tx) => {
		await assertPhonemesBelongToLanguage(tx, data.phonemeIds, lang.id)

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

		return { ...created, phonemes: await loadFoldedPhonemes(tx, created.id) }
	})
}

export async function updateGrapheme(slug: string, graphemeId: number, data: UpdateGraphemeInput) {
	const lang = await assertLanguage(slug)
	await assertGraphemeInLanguage(lang.id, graphemeId)

	return db.transaction(async (tx) => {
		const updates: Partial<typeof graphemes.$inferInsert> = { updatedAt: new Date() }
		if (data.grapheme !== undefined) updates.grapheme = data.grapheme
		if (data.romanization !== undefined) updates.romanization = data.romanization?.trim() || null
		if (data.environment !== undefined) updates.environment = normalizeEnvironment(data.environment)
		if (data.notes !== undefined) updates.notes = data.notes?.trim() || null
		if (data.sortOrder !== undefined && data.sortOrder !== null) updates.sortOrder = data.sortOrder

		const [row] = await tx
			.update(graphemes)
			.set(updates)
			.where(eq(graphemes.id, graphemeId))
			.returning()

		if (data.phonemeIds !== undefined) {
			await assertPhonemesBelongToLanguage(tx, data.phonemeIds, lang.id)
			await tx.delete(graphemePhonemes).where(eq(graphemePhonemes.graphemeId, graphemeId))
			if (data.phonemeIds.length > 0) {
				await tx.insert(graphemePhonemes).values(
					data.phonemeIds.map((pid, index) => ({ graphemeId, phonemeId: pid, position: index })),
				)
			}
		}

		return { ...row, phonemes: await loadFoldedPhonemes(tx, graphemeId) }
	})
}

export async function deleteGrapheme(slug: string, graphemeId: number) {
	const lang = await assertLanguage(slug)
	await assertGraphemeInLanguage(lang.id, graphemeId)
	await db.delete(graphemes).where(eq(graphemes.id, graphemeId))
	return { ok: true }
}

export async function reorderGraphemes(slug: string, order: number[]) {
	const lang = await assertLanguage(slug)

	await db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: graphemes.id })
			.from(graphemes)
			.where(eq(graphemes.languageId, lang.id))
		const existing = new Set(rows.map(r => r.id))

		if (validateReorderPayload(order, existing) !== 'ok') {
			throw error(400, 'Order array must match the language\'s graphemes exactly')
		}

		for (const [index, id] of order.entries()) {
			await tx.update(graphemes)
				.set({ sortOrder: index, updatedAt: new Date() })
				.where(and(eq(graphemes.id, id), eq(graphemes.languageId, lang.id)))
		}
	})

	return { ok: true }
}
