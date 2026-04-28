import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, graphemes, graphemePhonemes, phonemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody } from '$lib/server/utils.js'
import { normalizeEnvironment } from '../+server.js'
import { eq, and, asc, inArray } from 'drizzle-orm'

const updateGraphemeSchema = z.object({
	grapheme: z.string().min(1).optional(),
	phonemeIds: z.array(z.number().int()).optional(),
	romanization: z.string().nullish(),
	environment: z.string().nullish(),
	notes: z.string().nullish(),
	sortOrder: z.number().int().nullish(),
})

async function resolveGrapheme(langSlug: string, id: number) {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, langSlug))
	if (!lang) return { error: 'Language not found', status: 404 as const }
	const [row] = await db
		.select()
		.from(graphemes)
		.where(and(eq(graphemes.id, id), eq(graphemes.languageId, lang.id)))
	if (!row) return { error: 'Grapheme not found', status: 404 as const }
	return { lang, row }
}

/** PATCH /api/languages/:slug/graphemes/:id */
export const PATCH: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 })

	const resolved = await resolveGrapheme(event.params.slug, id)
	if ('error' in resolved) return json({ error: resolved.error }, { status: resolved.status })

	const data = await parseBody(event.request, updateGraphemeSchema)
	if (data instanceof Response) return data

	try {
		const updated = await db.transaction(async (tx) => {
			const updates: Partial<typeof graphemes.$inferInsert> = { updatedAt: new Date() }
			if (data.grapheme !== undefined) updates.grapheme = data.grapheme
			if (data.romanization !== undefined) updates.romanization = data.romanization?.trim() || null
			if (data.environment !== undefined) updates.environment = normalizeEnvironment(data.environment)
			if (data.notes !== undefined) updates.notes = data.notes?.trim() || null
			if (data.sortOrder !== undefined && data.sortOrder !== null) updates.sortOrder = data.sortOrder

			const [row] = await tx
				.update(graphemes)
				.set(updates)
				.where(eq(graphemes.id, id))
				.returning()

			if (data.phonemeIds !== undefined) {
				if (data.phonemeIds.length > 0) {
					const foundRows = await tx
						.select({ id: phonemes.id })
						.from(phonemes)
						.where(and(inArray(phonemes.id, data.phonemeIds), eq(phonemes.languageId, resolved.lang.id)))
					const found = new Set(foundRows.map(r => r.id))
					if (!data.phonemeIds.every(pid => found.has(pid))) {
						throw new Error('CROSS_LANGUAGE_PHONEME')
					}
				}
				await tx.delete(graphemePhonemes).where(eq(graphemePhonemes.graphemeId, id))
				if (data.phonemeIds.length > 0) {
					await tx.insert(graphemePhonemes).values(
						data.phonemeIds.map((pid, index) => ({ graphemeId: id, phonemeId: pid, position: index })),
					)
				}
			}

			const links = await tx
				.select({
					phonemeId: graphemePhonemes.phonemeId,
					position: graphemePhonemes.position,
					ipa: phonemes.ipa,
					type: phonemes.type,
				})
				.from(graphemePhonemes)
				.innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
				.where(eq(graphemePhonemes.graphemeId, id))
				.orderBy(asc(graphemePhonemes.position))

			return { ...row, phonemes: links.map(l => ({ phonemeId: l.phonemeId, ipa: l.ipa, type: l.type })) }
		})
		return json(updated)
	} catch (error) {
		if (error instanceof Error && error.message === 'CROSS_LANGUAGE_PHONEME') {
			return json({ error: 'One or more phonemes do not belong to this language' }, { status: 400 })
		}
		return json({ error: 'Failed to update grapheme' }, { status: 500 })
	}
}

/** DELETE /api/languages/:slug/graphemes/:id */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 })

	const resolved = await resolveGrapheme(event.params.slug, id)
	if ('error' in resolved) return json({ error: resolved.error }, { status: resolved.status })

	try {
		await db.delete(graphemes).where(eq(graphemes.id, id))
		return json({ ok: true })
	} catch {
		return json({ error: 'Failed to delete grapheme' }, { status: 500 })
	}
}
