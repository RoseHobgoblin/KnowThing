import { db } from '$lib/server/db/index.js'
import {
	inflectionDimensions,
	paradigmClasses,
	paradigmRules,
	lexiconInflections,
	inflectedForms,
	lexicon,
	languages,
} from '$lib/server/db/schema.js'
import { eq, and, asc, sql } from 'drizzle-orm'

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

// ── Pattern application ─────────────────────────────────────────

/** Apply a pattern to a stem: "{stem}n" + "tsida" → "tsidan" */
export function applyPattern(pattern: string, stem: string): string {
	if (!pattern.includes('{stem}')) return pattern // literal override
	return pattern.replaceAll('{stem}', stem)
}

const MAX_CELL_KEYS = 1000

/** Generate all cell keys from dimensions (cartesian product) */
export function generateCellKeys(dimensions: Dimension[]): string[] {
	if (dimensions.length === 0) return []

	const total = dimensions.reduce((accumulator, d) => accumulator * d.values.length, 1)
	if (total > MAX_CELL_KEYS) {
		throw new Error(`Too many inflection cells (${total}). Maximum is ${MAX_CELL_KEYS}. Reduce dimension values.`)
	}

	const sorted = [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder)

	function cartesian(dimIndex: number): string[] {
		if (dimIndex >= sorted.length) return ['']
		const rest = cartesian(dimIndex + 1)
		const result: string[] = []
		for (const value of sorted[dimIndex].values) {
			for (const suffix of rest) {
				result.push(suffix ? `${value}.${suffix}` : value)
			}
		}
		return result
	}

	return cartesian(0)
}

// ── Data loading ────────────────────────────────────────────────

/** Get dimensions for a language+POS */
export async function getDimensions(languageId: number, partOfSpeech: string): Promise<Dimension[]> {
	const dims = await db
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
async function getRulesMap(classId: number): Promise<Record<string, string>> {
	const rules = await db
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
export async function getInflectionTable(entryId: number): Promise<InflectionTable> {
	// Get entry's language and POS (from first definition)
	const [entry] = await db
		.select({ languageId: lexicon.languageId })
		.from(lexicon)
		.where(eq(lexicon.id, entryId))

	if (!entry) return { dimensions: [], forms: {}, overrides: {}, className: null, stem: null, hasInflection: false }

	// Get inflection assignment
	const [infl] = await db
		.select()
		.from(lexiconInflections)
		.where(eq(lexiconInflections.entryId, entryId))

	if (!infl) return { dimensions: [], forms: {}, overrides: {}, className: null, stem: null, hasInflection: false }

	// Get POS from the first definition (for dimension lookup)
	const [firstDef] = await db.execute(sql`
		SELECT part_of_speech FROM definitions WHERE entry_id = ${entryId} ORDER BY sense_number LIMIT 1
	`)
	const pos = (firstDef as any)?.part_of_speech || 'noun'

	// Get dimensions
	const dimensions = await getDimensions(entry.languageId, pos)
	if (dimensions.length === 0) return { dimensions: [], forms: {}, overrides: {}, className: null, stem: infl.stem, hasInflection: true }

	// Generate all cell keys
	const cellKeys = generateCellKeys(dimensions)

	// Get paradigm rules if class assigned
	let rules: Record<string, string> = {}
	let className: string | null = null
	if (infl.classId) {
		rules = await getRulesMap(infl.classId)
		const [cls] = await db.select({ name: paradigmClasses.name }).from(paradigmClasses).where(eq(paradigmClasses.id, infl.classId))
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
export async function rebuildInflectedForms(entryId: number): Promise<void> {
	const table = await getInflectionTable(entryId)
	if (!table.hasInflection) {
		await db.delete(inflectedForms).where(eq(inflectedForms.entryId, entryId))
		return
	}

	const overrideKeys = new Set(Object.keys(table.overrides))

	// Delete existing
	await db.delete(inflectedForms).where(eq(inflectedForms.entryId, entryId))

	// Insert all forms
	const entries = Object.entries(table.forms).filter(([_, form]) => form.trim())
	if (entries.length > 0) {
		await db.insert(inflectedForms).values(
			entries.map(([cellKey, form]) => ({
				entryId,
				form,
				cellKey,
				isOverride: overrideKeys.has(cellKey),
			})),
		).onConflictDoNothing()
	}
}

/** Rebuild all entries for a paradigm class */
export async function rebuildClassForms(classId: number): Promise<void> {
	const entries = await db
		.select({ entryId: lexiconInflections.entryId })
		.from(lexiconInflections)
		.where(eq(lexiconInflections.classId, classId))

	for (const e of entries) {
		await rebuildInflectedForms(e.entryId)
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
