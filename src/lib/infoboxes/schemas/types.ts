import type { FieldMap } from '../types.js'
import type { InfoboxType } from '../types.js'

export type InfoboxRowSpec = {
	label: string
	keys?: string[]
	compose?: (fields: FieldMap) => string
}

export type InfoboxSection = {
	heading?: string
	rows: InfoboxRowSpec[]
}

export type InfoboxSchema = {
	id: InfoboxType
	title: string[]
	subtitle?: string[]
	image: string[]
	caption: string[]
	sections: InfoboxSection[]
	/** Extra keys consumed by `compose` rows that wouldn't otherwise appear in any `keys` array; excluded from the fallback list. */
	extraKeys?: string[]
}

export function knownKeys(schema: InfoboxSchema): Set<string> {
	const out = new Set<string>()
	for (const key of schema.title) out.add(key)
	for (const key of schema.subtitle ?? []) out.add(key)
	for (const key of schema.image) out.add(key)
	for (const key of schema.caption) out.add(key)
	for (const section of schema.sections) {
		for (const row of section.rows) {
			for (const key of row.keys ?? []) out.add(key)
		}
	}
	for (const key of schema.extraKeys ?? []) out.add(key)
	return out
}
