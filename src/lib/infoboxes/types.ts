import type { TemplateArg } from '$lib/parser/types.js'

// ============================================================================
// Infobox type detection and field helpers
// ============================================================================

export type InfoboxType =
	| 'country'
	| 'former_country'
	| 'language'
	| 'settlement'
	| 'royalty'
	| 'officeholder'
	| 'person'
	| 'religion'
	| 'star'
	| 'planet'
	| 'system'
	| 'generic'

/** Map of normalized field name -> value, built from TemplateArg[] */
export type FieldMap = Map<string, string>

/** Normalize a field key: lowercase, spaces → underscores, trim */
function normalizeKey(key: string): string {
	return key.trim().toLowerCase().replaceAll(/\s+/g, '_')
}

/** Convert TemplateArg[] to a FieldMap for easy lookup */
export function buildFieldMap(args: TemplateArg[]): FieldMap {
	const map = new Map<string, string>()
	let positional = 0
	for (const argument of args) {
		if (argument.name) {
			map.set(normalizeKey(argument.name), argument.value.trim())
		} else {
			positional++
			map.set(String(positional), argument.value.trim())
		}
	}
	return map
}

/** Get field value by trying multiple alias keys */
export function getField(fields: FieldMap, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = fields.get(normalizeKey(key))
		if (value) return value
	}
	return undefined
}

/** Check if any of the given keys exist and are non-empty */
export function hasField(fields: FieldMap, ...keys: string[]): boolean {
	return getField(fields, ...keys) !== undefined
}

/** Get numbered fields like leader_title1..leader_title14 */
export function getNumberedFields(
	fields: FieldMap,
	prefix: string,
	max: number = 16,
): { index: number, value: string }[] {
	const results: { index: number, value: string }[] = []
	// Check base (no number)
	const base = fields.get(prefix.toLowerCase())
	if (base) results.push({ index: 0, value: base })
	// Check numbered
	for (let index = 1; index <= max; index++) {
		const value = fields.get(`${prefix.toLowerCase()}${index}`)
		if (value) results.push({ index: index, value: value })
	}
	return results
}

/** Get all fields not in the "used" set */
export function getRemainingFields(fields: FieldMap, used: Set<string>): [string, string][] {
	const remaining: [string, string][] = []
	for (const [key, value] of fields) {
		if (!used.has(key) && value && !/^\d+$/.test(key)) {
			remaining.push([key, value])
		}
	}
	return remaining
}
