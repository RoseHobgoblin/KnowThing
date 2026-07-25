import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { deleteContentByDomainSlug } from '$lib/server/services/content-records.js'
import { archiveEntity } from '$lib/server/services/entity-spine.js'
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
 * Apply an explicit slug change with normalization and conflict check.
 * Unlike applyNameUpdate's silent keep-old-slug on collision, an explicitly
 * requested slug that collides is an error the caller should see.
 */
export async function applySlugUpdate(
	setClause: Record<string, unknown>,
	requestedSlug: string,
	currentSlug: string,
	table: PgTable,
	idColumn: PgColumn,
	slugColumn: PgColumn,
): Promise<void> {
	const newSlug = urlSlugify(requestedSlug)
	if (!newSlug) throw error(400, 'Slug must contain at least one letter or number')
	if (newSlug === currentSlug) return
	const [conflict] = await db.select({ id: idColumn }).from(table).where(eq(slugColumn, newSlug))
	if (conflict) throw error(409, 'This slug is already in use')
	setClause.slug = newSlug
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
 * Merge "lock to override" display-string fields into the `extra` JSONB overflow.
 * A non-empty string sets the override; null/empty/undefined clears it. Non-override
 * keys already in `baseExtra` are preserved. `mapping` is dataField → extra key.
 */
export function mergeOverrideExtras(
	baseExtra: unknown,
	data: Record<string, unknown>,
	mapping: Record<string, string>,
): Record<string, unknown> {
	const extra: Record<string, unknown> = { ...(baseExtra as Record<string, unknown> | null) }
	for (const [field, key] of Object.entries(mapping)) {
		if (data[field] === undefined) continue
		const value = data[field]
		if (typeof value === 'string' && value.trim() !== '') extra[key] = value.trim()
		else delete extra[key]
	}
	return extra
}

export const STAR_OVERRIDE_MAP = {
	density: 'density',
	surfaceGravity: 'surface_gravity',
	escapeVelocity: 'escape_velocity',
	luminosity: 'luminosity',
} as const

export const BODY_OVERRIDE_MAP = {
	density: 'density',
	surfaceGravity: 'surface_gravity',
	escapeVelocity: 'escape_velocity',
} as const

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
			.returning() as Array<{ slug?: string, entityId?: number | null }>

		if (!removed) return null

		if (removed.slug) await deleteContentByDomainSlug(tx, 'celestial', removed.slug)
		// Archive, never hard-delete: routes keep resolving (banner, not 404).
		await archiveEntity(tx, removed.entityId ?? null)
		return removed
	})

	if (!deleted) {
		throw error(404, `${entityName} not found`)
	}

	return { success: true }
}
