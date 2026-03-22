import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { paradigmClasses, paradigmRules } from '$lib/server/db/schema.js'
import { requireAuth, requireRole } from '$lib/server/auth.js'
import { eq, asc } from 'drizzle-orm'
import { rebuildClassForms } from '$lib/server/wordbook/inflection.js'

/** GET /api/languages/:slug/inflections/classes/:classId — class with all rules */
export const GET: RequestHandler = async ({ params }) => {
	const classId = Number.parseInt(params.classId)
	if (isNaN(classId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [cls] = await db.select().from(paradigmClasses).where(eq(paradigmClasses.id, classId))
	if (!cls) return json({ error: 'Class not found' }, { status: 404 })

	const rules = await db
		.select()
		.from(paradigmRules)
		.where(eq(paradigmRules.classId, classId))
		.orderBy(asc(paradigmRules.cellKey))

	return json({ ...cls, rules })
}

/** PUT /api/languages/:slug/inflections/classes/:classId — bulk update rules */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const classId = Number.parseInt(event.params.classId)
	if (isNaN(classId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { name, description, rules } = body as {
		name?: string
		description?: string
		rules?: Array<{ cellKey: string, pattern: string }>
	}

	// Update class metadata
	if (name || description !== undefined) {
		await db.update(paradigmClasses).set({
			...(name && { name: name.trim() }),
			...(description !== undefined && { description: description?.trim() || null }),
		}).where(eq(paradigmClasses.id, classId))
	}

	// Bulk replace rules
	if (rules) {
		await db.delete(paradigmRules).where(eq(paradigmRules.classId, classId))
		const validRules = rules.filter(r => r.cellKey?.trim() && r.pattern?.trim())
		if (validRules.length > 0) {
			await db.insert(paradigmRules).values(
				validRules.map(r => ({
					classId,
					cellKey: r.cellKey.trim(),
					pattern: r.pattern.trim(),
				})),
			)
		}

		// Rebuild all inflected forms for entries using this class
		await rebuildClassForms(classId)
	}

	return json({ success: true })
}

/** DELETE /api/languages/:slug/inflections/classes/:classId */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const classId = Number.parseInt(event.params.classId)
	if (isNaN(classId)) return json({ error: 'Invalid ID' }, { status: 400 })

	const [deleted] = await db.delete(paradigmClasses).where(eq(paradigmClasses.id, classId)).returning()
	if (!deleted) return json({ error: 'Class not found' }, { status: 404 })
	return json({ success: true })
}
