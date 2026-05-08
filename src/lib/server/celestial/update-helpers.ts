import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { deleteContentByDomainSlug } from '$lib/server/services/content-records.js'
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
 * Delete a celestial entity and clean up its content record. Throws 404 if not found.
 */
export async function deleteCelestialEntity(
	table: PgTable,
	slugColumn: PgColumn,
	slug: string,
	entityName: string,
): Promise<{ success: true }> {
	const deleted = await db.transaction(async (tx) => {
		const [removed] = await tx
			.delete(table)
			.where(eq(slugColumn, slug))
			.returning() as Array<{ slug?: string }>

		if (!removed) return null

		if (removed.slug) await deleteContentByDomainSlug(tx, 'celestial', removed.slug)
		return removed
	})

	if (!deleted) {
		throw error(404, `${entityName} not found`)
	}

	return { success: true }
}
