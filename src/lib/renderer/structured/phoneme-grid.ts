import {
	CANONICAL_PLACES,
	CANONICAL_MANNERS,
	CANONICAL_HEIGHTS,
	CANONICAL_BACKNESS,
	CANONICAL_SUBTYPES,
	canonicalComparator,
} from './phoneme-ordering.js'

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
 * - Axis values are derived from distinct values present in the data.
 * - Columns and rows are sorted by canonical IPA order; conlang-specific
 *   values (not in the canonical IPA chart) fall through to alphabetical at
 *   the end, so familiar axes always come first.
 * - Within each cell, voiceless goes before voiced (consonants) and
 *   unrounded before rounded (vowels), matching Wikipedia's IPA charts.
 * - Footnotes are collected across all phonemes with non-empty notes.
 */
export function buildPhonemeGrid(
	data: PhonemeRow[] | null,
	type: 'consonant' | 'vowel',
): PhonemeGridModel | null {
	if (!data || data.length === 0) return null

	const colKey = type === 'consonant' ? 'place' : 'backness'
	const rowKey = type === 'consonant' ? 'manner' : 'height'
	const colComparator = canonicalComparator(type === 'consonant' ? CANONICAL_PLACES : CANONICAL_BACKNESS)
	const rowComparator = canonicalComparator(type === 'consonant' ? CANONICAL_MANNERS : CANONICAL_HEIGHTS)
	const subtypeComparator = canonicalComparator(CANONICAL_SUBTYPES)

	const columnSet = new Set<string>()
	const rowMap = new Map<string, Set<string | undefined>>()

	for (const r of data) {
		const col = (r[colKey] ?? '') as string
		if (col) columnSet.add(col)
		const header = (r[rowKey] ?? '') as string
		const subtype = r.subtype ?? undefined
		if (header) {
			const subs = rowMap.get(header) ?? new Set<string | undefined>()
			subs.add(subtype)
			rowMap.set(header, subs)
		}
	}

	const columns = [...columnSet].toSorted(colComparator)
	const rowPairs: { header: string, subtype?: string }[] = []
	for (const header of [...rowMap.keys()].toSorted(rowComparator)) {
		const subs = [...(rowMap.get(header) ?? [])].toSorted((a, b) => {
			if (a === undefined && b === undefined) return 0
			if (a === undefined) return -1
			if (b === undefined) return 1
			return subtypeComparator(a, b)
		})
		for (const sub of subs) rowPairs.push({ header, subtype: sub })
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

	// Within a cell: voiceless before voiced (consonant convention), unrounded
	// before rounded (vowel convention). Wikipedia-style IPA chart ordering.
	for (const list of cells.values()) {
		list.sort((a, b) => {
			const voicingOrder: Record<string, number> = { voiceless: 0, voiced: 1 }
			const voicingDelta = (voicingOrder[a.voicing ?? ''] ?? 2) - (voicingOrder[b.voicing ?? ''] ?? 2)
			if (voicingDelta !== 0) return voicingDelta
			const roundA = a.rounded === true ? 1 : (a.rounded === false ? 0 : 2)
			const roundB = b.rounded === true ? 1 : (b.rounded === false ? 0 : 2)
			return roundA - roundB
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
