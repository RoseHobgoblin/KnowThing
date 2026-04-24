export interface PhonemeRow {
	id?: number
	ipa: string
	type: string
	place?: string | null
	manner?: string | null
	subtype?: string | null
	voicing?: string | null
	height?: string | null
	backness?: string | null
	rounded?: boolean | null
	notes?: string | null
	sortOrder?: number | null
	sort_order?: number | null
}

export interface PhonemeGridModel {
	columns: string[]
	rows: { header: string, subtype?: string }[]
	/** Keyed by `${header} ${subtype ?? ''} ${col}`. Empty cells are absent. */
	cells: Map<string, PhonemeRow[]>
	footnotes: { index: number, ipa: string, text: string }[]
}

/**
 * Build a sparse manner×place (or height×backness) grid from a phoneme list.
 * - Axis values are derived from distinct values present in the data, preserving
 *   first-occurrence order (sort_order drives the input list).
 * - Within each cell, voiceless is placed before voiced (Wikipedia convention).
 * - Footnotes are collected across all phonemes with non-empty notes.
 */
export function buildPhonemeGrid(
	data: PhonemeRow[] | null,
	type: 'consonant' | 'vowel',
): PhonemeGridModel | null {
	if (!data || data.length === 0) return null

	const colKey = type === 'consonant' ? 'place' : 'backness'
	const rowKey = type === 'consonant' ? 'manner' : 'height'

	const seenCols = new Set<string>()
	const columns: string[] = []
	const rowPairs: { header: string, subtype?: string }[] = []
	const seenRowKeys = new Set<string>()

	for (const r of data) {
		const col = (r[colKey] ?? '') as string
		if (col && !seenCols.has(col)) {
			seenCols.add(col)
			columns.push(col)
		}
		const header = (r[rowKey] ?? '') as string
		const subtype = r.subtype ?? undefined
		const rowKeyString = `${header} ${subtype ?? ''}`
		if (header && !seenRowKeys.has(rowKeyString)) {
			seenRowKeys.add(rowKeyString)
			rowPairs.push({ header, subtype })
		}
	}

	const cells = new Map<string, PhonemeRow[]>()
	const footnotes: { index: number, ipa: string, text: string }[] = []

	for (const r of data) {
		const col = (r[colKey] ?? '') as string
		const header = (r[rowKey] ?? '') as string
		const subtype = r.subtype ?? undefined
		if (col && header) {
			const cellKey = `${header} ${subtype ?? ''} ${col}`
			const list = cells.get(cellKey) ?? []
			list.push(r)
			cells.set(cellKey, list)
		}

		if (r.notes?.trim()) {
			footnotes.push({ index: footnotes.length + 1, ipa: r.ipa, text: r.notes.trim() })
		}
	}

	for (const list of cells.values()) {
		list.sort((a, b) => {
			const order: Record<string, number> = { voiceless: 0, voiced: 1 }
			return (order[a.voicing ?? ''] ?? 2) - (order[b.voicing ?? ''] ?? 2)
		})
	}

	return { columns, rows: rowPairs, cells, footnotes }
}

export function cellKey(row: { header: string, subtype?: string }, col: string): string {
	return `${row.header} ${row.subtype ?? ''} ${col}`
}

export function footnoteIndex(ipa: string, footnotes: { ipa: string, index: number }[]): number | null {
	return footnotes.find(f => f.ipa === ipa)?.index ?? null
}
