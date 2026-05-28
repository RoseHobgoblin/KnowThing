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
	return out
}
