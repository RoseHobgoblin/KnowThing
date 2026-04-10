import { json } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { deleteCelestialContentRecord } from '$lib/server/services/celestial-content.js'
import { urlSlugify } from '$lib/utils/slugify.js'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

/**
 * Apply name change with auto-slug derivation and conflict check.
 */
export async function applyNameUpdate(
	setClause: Record<string, unknown>,
	name: string,
	currentSlug: string,
	table: PgTable,
	idColumn: PgColumn,
	slugColumn: PgColumn,
): Promise<void> {
	setClause.name = name.trim()
	const newSlug = urlSlugify(name)
	if (newSlug && newSlug !== currentSlug) {
		const [conflict] = await db.select({ id: idColumn }).from(table).where(eq(slugColumn, newSlug))
		if (!conflict) setClause.slug = newSlug
	}
}

/**
 * Copy fields from parsed Zod data to a setClause object.
 * Text fields get `.trim() || null`, numeric fields get `?? null`.
 */
export function applyFieldUpdates(
	setClause: Record<string, unknown>,
	data: Record<string, unknown>,
	textFields: readonly string[],
	numericFields: readonly string[],
): void {
	for (const f of textFields) {
		if (data[f] !== undefined) setClause[f] = (data[f] as string)?.trim() || null
	}
	for (const f of numericFields) {
		if (data[f] !== undefined) setClause[f] = data[f] ?? null
	}
}

/**
 * Delete a celestial entity and clean up its content record.
 */
export async function deleteCelestialEntity(
	table: PgTable,
	slugColumn: PgColumn,
	slug: string,
	entityName: string,
): Promise<Response> {
	const deleted = await db.transaction(async (tx) => {
		const [removed] = await (tx as any)
			.delete(table)
			.where(eq(slugColumn, slug))
			.returning()

		if (!removed) return null

		await deleteCelestialContentRecord(tx, removed.contentRecordId)
		return removed
	})

	if (!deleted) {
		return json({ error: `${entityName} not found` }, { status: 404 })
	}

	return json({ success: true })
}
