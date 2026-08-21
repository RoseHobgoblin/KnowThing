import { db } from '$lib/server/db/index.js'
import {
	inflectionDimensions,
	paradigmClasses,
	paradigmRules,
	lexiconInflections,
	inflectedForms,
	lexicon,
	languages,
} from '$lib/feature/wordbook/server/schema.server.js'
import { eq, and, asc, sql, inArray } from 'drizzle-orm'
import { applyPattern, generateCellKeys } from '$lib/feature/wordbook/cell-keys.js'

/** Either the root db or a transaction — lets rebuilds run atomically inside callers' txs. */
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>

// ── Types ───────────────────────────────────────────────────────

export interface Dimension {
	id: number
	name: string
	values: string[]
	sortOrder: number
}

export interface InflectionTable {
	dimensions: Dimension[]
	forms: Record<string, string> // cell_key → form string
	overrides: Record<string, string> // cell_key → override (to mark irregular)
	className: string | null
	stem: string | null
	hasInflection: boolean
}

// Re-export for consumers (applyPattern lives in the shared lib — it's pure
// and also drives editor previews)
export { applyPattern, generateCellKeys } from '$lib/feature/wordbook/cell-keys.js'

// ── Data loading ────────────────────────────────────────────────

/** Get dimensions for a language+POS */
export async function getDimensions(languageId: number, partOfSpeech: string, executor: DbExecutor = db): Promise<Dimension[]> {
	const dims = await executor
		.select()
		.from(inflectionDimensions)
		.where(and(
			eq(inflectionDimensions.languageId, languageId),
			eq(inflectionDimensions.partOfSpeech, partOfSpeech),
		))
		.orderBy(asc(inflectionDimensions.sortOrder))

	return dims.map(d => ({
		id: d.id,
		name: d.name,
		values: d.dimValues,
		sortOrder: d.sortOrder,
	}))
}

/** Get paradigm rules as a map */
async function getRulesMap(classId: number, executor: DbExecutor = db): Promise<Record<string, string>> {
	const rules = await executor
		.select({ cellKey: paradigmRules.cellKey, pattern: paradigmRules.pattern })
		.from(paradigmRules)
		.where(eq(paradigmRules.classId, classId))

	const map: Record<string, string> = {}
	for (const r of rules) {
		map[r.cellKey] = r.pattern
	}
	return map
}

/** Get the full inflection table for an entry */
export async function getInflectionTable(entryId: number, executor: DbExecutor = db): Promise<InflectionTable> {
	// Get entry's language and POS (from first definition)
	const [entry] = await executor
		.select({ languageId: lexicon.languageId })
		.from(lexicon)
		.where(eq(lexicon.id, entryId))

	if (!entry) return { dimensions: [], forms: {}, overrides: {}, className: null, stem: null, hasInflection: false }

	// Get inflection assignment
	const [infl] = await executor
		.select()
		.from(lexiconInflections)
		.where(eq(lexiconInflections.entryId, entryId))

	if (!infl) return { dimensions: [], forms: {}, overrides: {}, className: null, stem: null, hasInflection: false }

	// Get POS from the first definition (for dimension lookup)
	const [firstDef] = await executor.execute(sql`
		SELECT part_of_speech FROM definitions WHERE entry_id = ${entryId} ORDER BY sense_number LIMIT 1
	`)
	const pos = (firstDef as any)?.part_of_speech || 'noun'

	// Get dimensions
	const dimensions = await getDimensions(entry.languageId, pos, executor)
	if (dimensions.length === 0) return { dimensions: [], forms: {}, overrides: {}, className: null, stem: infl.stem, hasInflection: true }

	// Generate all cell keys
	const cellKeys = generateCellKeys(dimensions)

	// Get paradigm rules if class assigned
	let rules: Record<string, string> = {}
	let className: string | null = null
	if (infl.classId) {
		rules = await getRulesMap(infl.classId, executor)
		const [cls] = await executor.select({ name: paradigmClasses.name }).from(paradigmClasses).where(eq(paradigmClasses.id, infl.classId))
		className = cls?.name || null
	}

	// Build forms: rule-generated + overrides
	const overrides = (infl.overrides || {}) as Record<string, string>
	const forms: Record<string, string> = {}

	for (const key of cellKeys) {
		if (overrides[key]) {
			forms[key] = overrides[key]
		} else if (rules[key] && infl.stem) {
			forms[key] = applyPattern(rules[key], infl.stem)
		}
	}

	return { dimensions, forms, overrides, className, stem: infl.stem, hasInflection: true }
}

// ── Index management ────────────────────────────────────────────

/** Rebuild the inflected_forms search index for an entry */
export async function rebuildInflectedForms(entryId: number, executor: DbExecutor = db): Promise<void> {
	const table = await getInflectionTable(entryId, executor)
	if (!table.hasInflection) {
		await executor.delete(inflectedForms).where(eq(inflectedForms.entryId, entryId))
		return
	}

	const overrideKeys = new Set(Object.keys(table.overrides))

	// Delete existing, then insert all forms (uniqueness on (entry_id, cell_key)
	// is enforced by the DB — see migration 0036)
	await executor.delete(inflectedForms).where(eq(inflectedForms.entryId, entryId))

	const entries = Object.entries(table.forms).filter(([_, form]) => form.trim())
	if (entries.length > 0) {
		await executor.insert(inflectedForms).values(
			entries.map(([cellKey, form]) => ({
				entryId,
				form,
				cellKey,
				isOverride: overrideKeys.has(cellKey),
			})),
		)
	}
}

/**
 * Rebuild all entries for a paradigm class. Pass the caller's transaction to
 * make the rebuild atomic with the caller's writes; without one, it opens its
 * own transaction.
 */
export async function rebuildClassForms(classId: number, executor?: DbExecutor): Promise<void> {
	const run = async (tx: DbExecutor) => {
		const entries = await tx
			.select({ entryId: lexiconInflections.entryId })
			.from(lexiconInflections)
			.where(eq(lexiconInflections.classId, classId))

		if (entries.length === 0) return
		const ids = entries.map(e => e.entryId)

		// One bulk delete instead of N per-entry deletes
		await tx.delete(inflectedForms).where(inArray(inflectedForms.entryId, ids))

		for (const e of entries) {
			const table = await getInflectionTable(e.entryId, tx)
			if (!table.hasInflection) continue
			const overrideKeys = new Set(Object.keys(table.overrides))
			const rows = Object.entries(table.forms).filter(([_, form]) => form.trim())
			if (rows.length > 0) {
				await tx.insert(inflectedForms).values(
					rows.map(([cellKey, form]) => ({
						entryId: e.entryId,
						form,
						cellKey,
						isOverride: overrideKeys.has(cellKey),
					})),
				)
			}
		}
	}

	if (executor) {
		await run(executor)
	} else {
		await db.transaction(run)
	}
}

/** Look up which headword an inflected form belongs to */
export async function lookupInflectedForm(
	form: string,
	languageId?: number,
): Promise<Array<{ entryId: number, word: string, cellKey: string, languageSlug: string }>> {
	let query = db
		.select({
			entryId: inflectedForms.entryId,
			word: lexicon.word,
			cellKey: inflectedForms.cellKey,
			languageSlug: languages.slug,
		})
		.from(inflectedForms)
		.innerJoin(lexicon, eq(inflectedForms.entryId, lexicon.id))
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(sql`LOWER(${inflectedForms.form}) = LOWER(${form})`)
		.$dynamic()

	if (languageId) {
		query = query.where(and(
			sql`LOWER(${inflectedForms.form}) = LOWER(${form})`,
			eq(lexicon.languageId, languageId),
		))
	}

	return query.limit(10)
}
