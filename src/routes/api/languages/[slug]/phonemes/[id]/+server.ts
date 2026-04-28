import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, phonemes, graphemePhonemes, graphemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, normalizeAxis } from '$lib/server/utils.js'
import { eq, and, asc, sql } from 'drizzle-orm'

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
	marginal: z.boolean().nullish(),
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

/** GET /api/languages/:slug/phonemes/:id — includes the set of graphemes that
 * reference this phoneme, so the editor can show a "Written as" read-only list. */
export const GET: RequestHandler = async (event) => {
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 })

	const resolved = await resolvePhoneme(event.params.slug, id)
	if ('error' in resolved) return json({ error: resolved.error }, { status: resolved.status })

	// Group by grapheme so a multi-position reference (e.g. か → /k/+/a/+/k/+/a/
	// hypothetically uses the same phoneme twice) doesn't render the same
	// grapheme as two "Written as" chips.
	const linkedGraphemes = await db
		.selectDistinct({
			id: graphemes.id,
			grapheme: graphemes.grapheme,
			environment: graphemes.environment,
			sortOrder: graphemes.sortOrder,
		})
		.from(graphemePhonemes)
		.innerJoin(graphemes, eq(graphemePhonemes.graphemeId, graphemes.id))
		.where(eq(graphemePhonemes.phonemeId, id))
		.orderBy(asc(graphemes.sortOrder), asc(graphemes.id))

	return json({ ...resolved.row, graphemes: linkedGraphemes })
}

/** DELETE /api/languages/:slug/phonemes/:id
 * Returns affectedGraphemes — the count of graphemes that had at least one
 * link to this phoneme. The editor surfaces this to the user so "N graphemes
 * became silent" can be shown in the undo toast. */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 })

	const resolved = await resolvePhoneme(event.params.slug, id)
	if ('error' in resolved) return json({ error: resolved.error }, { status: resolved.status })

	try {
		const [countRow] = await db.execute(sql`
			SELECT COUNT(DISTINCT grapheme_id)::int AS n
			FROM grapheme_phonemes
			WHERE phoneme_id = ${id}
		`) as unknown as [{ n: number }]
		const affectedGraphemes = countRow?.n ?? 0

		await db.delete(phonemes).where(eq(phonemes.id, id))
		return json({ ok: true, affectedGraphemes })
	} catch {
		return json({ error: 'Failed to delete phoneme' }, { status: 500 })
	}
}
