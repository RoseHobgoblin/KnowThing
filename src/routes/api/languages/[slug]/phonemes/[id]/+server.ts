import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, phonemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody } from '$lib/server/utils.js'
import { eq, and } from 'drizzle-orm'

const updatePhonemeSchema = z.object({
	ipa: z.string().min(1).optional(),
	type: z.enum(['consonant', 'vowel', 'diphthong', 'special']).optional(),
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

async function resolvePhoneme(langSlug: string, id: number) {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, langSlug))
	if (!lang) return { error: 'Language not found', status: 404 as const }
	const [row] = await db
		.select()
		.from(phonemes)
		.where(and(eq(phonemes.id, id), eq(phonemes.languageId, lang.id)))
	if (!row) return { error: 'Phoneme not found', status: 404 as const }
	return { lang, row }
}

/** PATCH /api/languages/:slug/phonemes/:id */
export const PATCH: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 })

	const resolved = await resolvePhoneme(event.params.slug, id)
	if ('error' in resolved) return json({ error: resolved.error }, { status: resolved.status })

	const data = await parseBody(event.request, updatePhonemeSchema)
	if (data instanceof Response) return data

	const updates: Partial<typeof phonemes.$inferInsert> = { updatedAt: new Date() }
	if (data.ipa !== undefined) updates.ipa = data.ipa.trim()
	if (data.type !== undefined) updates.type = data.type
	if (data.place !== undefined) updates.place = data.place?.trim() || null
	if (data.manner !== undefined) updates.manner = data.manner?.trim() || null
	if (data.subtype !== undefined) updates.subtype = data.subtype?.trim() || null
	if (data.voicing !== undefined) updates.voicing = data.voicing ?? null
	if (data.height !== undefined) updates.height = data.height?.trim() || null
	if (data.backness !== undefined) updates.backness = data.backness?.trim() || null
	if (data.rounded !== undefined) updates.rounded = data.rounded ?? null
	if (data.notes !== undefined) updates.notes = data.notes?.trim() || null
	if (data.sortOrder !== undefined && data.sortOrder !== null) updates.sortOrder = data.sortOrder

	try {
		const [updated] = await db
			.update(phonemes)
			.set(updates)
			.where(eq(phonemes.id, id))
			.returning()
		return json(updated)
	} catch {
		return json({ error: 'Failed to update phoneme' }, { status: 500 })
	}
}

/** DELETE /api/languages/:slug/phonemes/:id */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 })

	const resolved = await resolvePhoneme(event.params.slug, id)
	if ('error' in resolved) return json({ error: resolved.error }, { status: resolved.status })

	try {
		await db.delete(phonemes).where(eq(phonemes.id, id))
		return json({ ok: true })
	} catch {
		return json({ error: 'Failed to delete phoneme' }, { status: 500 })
	}
}
