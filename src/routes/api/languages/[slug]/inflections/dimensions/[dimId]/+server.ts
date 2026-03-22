import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { inflectionDimensions, paradigmClasses, paradigmRules } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, and, asc, notInArray } from 'drizzle-orm'
import { generateCellKeys } from '$lib/wordbook/cell-keys.js'
import { rebuildClassForms } from '$lib/server/wordbook/inflection.js'

/** PUT /api/languages/:slug/inflections/dimensions/:dimId */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const dimId = Number.parseInt(event.params.dimId)
	if (isNaN(dimId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { name, values, sortOrder } = body as { name?: string, values?: string[], sortOrder?: number }

	const [updated] = await db
		.update(inflectionDimensions)
		.set({
			...(name && { name: name.trim() }),
			...(values && { dimValues: values.map(v => v.trim()) }),
			...(sortOrder !== undefined && { sortOrder }),
		})
		.where(eq(inflectionDimensions.id, dimId))
		.returning()

	if (!updated) return json({ error: 'Dimension not found' }, { status: 404 })
	return json(updated)
}

/** DELETE /api/languages/:slug/inflections/dimensions/:dimId */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const dimId = Number.parseInt(event.params.dimId)
	if (isNaN(dimId)) return json({ error: 'Invalid ID' }, { status: 400 })

	// Get the dimension before deleting (need its language + POS for cleanup)
	const [dim] = await db.select().from(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))
	if (!dim) return json({ error: 'Dimension not found' }, { status: 404 })

	// Delete the dimension
	await db.delete(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))

	// Clean orphaned rules: get remaining dimensions for this language+POS
	const remainingDims = await db
		.select({ dimValues: inflectionDimensions.dimValues, sortOrder: inflectionDimensions.sortOrder })
		.from(inflectionDimensions)
		.where(and(
			eq(inflectionDimensions.languageId, dim.languageId),
			eq(inflectionDimensions.partOfSpeech, dim.partOfSpeech),
		))
		.orderBy(asc(inflectionDimensions.sortOrder))

	// Get all classes for this language+POS
	const classes = await db
		.select({ id: paradigmClasses.id })
		.from(paradigmClasses)
		.where(and(
			eq(paradigmClasses.languageId, dim.languageId),
			eq(paradigmClasses.partOfSpeech, dim.partOfSpeech),
		))

	if (classes.length > 0) {
		const validKeys = remainingDims.length > 0
			? generateCellKeys(remainingDims.map(d => ({ values: d.dimValues, sortOrder: d.sortOrder })))
			: []

		for (const cls of classes) {
			if (validKeys.length === 0) {
				// No dimensions left — delete all rules for this class
				await db.delete(paradigmRules).where(eq(paradigmRules.classId, cls.id))
			} else {
				// Delete rules with cell keys that no longer exist
				await db.delete(paradigmRules).where(
					and(
						eq(paradigmRules.classId, cls.id),
						notInArray(paradigmRules.cellKey, validKeys),
					),
				)
			}
			// Rebuild inflected forms for entries using this class
			await rebuildClassForms(cls.id)
		}
	}

	return json({ success: true })
}
