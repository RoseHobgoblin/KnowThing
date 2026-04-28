import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, graphemes } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody } from '$lib/server/utils.js'
import { eq, and } from 'drizzle-orm'

const reorderSchema = z.object({
	order: z.array(z.number().int()),
})

/** POST /api/languages/:slug/graphemes/reorder — bulk sort_order update.
 * The `order` array must cover exactly the language's graphemes. */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const data = await parseBody(event.request, reorderSchema)
	if (data instanceof Response) return data

	try {
		await db.transaction(async (tx) => {
			const rows = await tx
				.select({ id: graphemes.id })
				.from(graphemes)
				.where(eq(graphemes.languageId, lang.id))
			const existing = new Set(rows.map(r => r.id))

			if (data.order.length !== existing.size) throw new Error('ORDER_MISMATCH')
			for (const id of data.order) {
				if (!existing.has(id)) throw new Error('ORDER_MISMATCH')
			}

			// sort_order has no uniqueness constraint, so direct per-row overwrite is safe.
			for (const [index, id] of data.order.entries()) {
				await tx.update(graphemes)
					.set({ sortOrder: index, updatedAt: new Date() })
					.where(and(eq(graphemes.id, id), eq(graphemes.languageId, lang.id)))
			}
		})
		return json({ ok: true })
	} catch (error) {
		if (error instanceof Error && error.message === 'ORDER_MISMATCH') {
			return json({ error: 'Order array must match the language\'s graphemes exactly' }, { status: 400 })
		}
		return json({ error: 'Failed to reorder graphemes' }, { status: 500 })
	}
}
