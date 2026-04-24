// Canonical axis orderings for the phoneme grid renderer.
//
// Derived from the IPA chart in `$lib/data/ipa-chart.ts` so the grid always
// looks like a linguistics textbook regardless of the order the user entered
// the phonemes. Any axis value the user invents (conlang-specific, e.g.
// "velaro-bilabial") falls through to alphabetical order AFTER the canonical
// ones, so familiar rows/columns always come first.

import { IPA_SECTIONS, type IpaEntry } from '$lib/data/ipa-chart.js'

function collectOrderedUnique(
	sections: typeof IPA_SECTIONS,
	picker: (entry: IpaEntry) => string | undefined,
	extraFromColumns?: (section: (typeof IPA_SECTIONS)[number]) => string[] | undefined,
): string[] {
	const seen = new Set<string>()
	const out: string[] = []
	for (const section of sections) {
		const extras = extraFromColumns?.(section) ?? []
		for (const value of extras) {
			if (value && !seen.has(value)) {
				seen.add(value)
				out.push(value)
			}
		}
		for (const entry of section.entries) {
			const value = picker(entry)
			if (value && !seen.has(value)) {
				seen.add(value)
				out.push(value)
			}
		}
	}
	return out
}

/** Canonical consonant place order (pulmonic columns first, then any others
 * that show up in affricates / non-pulmonic / co-articulated sections). */
export const CANONICAL_PLACES: string[] = collectOrderedUnique(
	IPA_SECTIONS,
	e => e.place,
	section => section.id === 'pulmonic' ? section.columns : undefined,
)

/** Canonical manner order (pulmonic rows first, then additional manners
 * introduced by affricates/non-pulmonic/co-articulated). */
export const CANONICAL_MANNERS: string[] = collectOrderedUnique(
	IPA_SECTIONS,
	e => e.manner,
	section => section.id === 'pulmonic' ? section.rows : undefined,
)

/** Canonical vowel height order. */
export const CANONICAL_HEIGHTS: string[] = collectOrderedUnique(
	IPA_SECTIONS.filter(s => s.id === 'vowels'),
	e => e.height,
	section => section.rows,
)

/** Canonical vowel backness order. */
export const CANONICAL_BACKNESS: string[] = collectOrderedUnique(
	IPA_SECTIONS.filter(s => s.id === 'vowels'),
	e => e.backness,
	section => section.columns,
)

/** Canonical subtype order within a manner row (Korean-style plosive rows). */
export const CANONICAL_SUBTYPES = ['plain', 'tense', 'aspirated', 'voiced', 'breathy', 'creaky']

/**
 * Build a comparator that places canonical values first (in the given order)
 * and pushes unknown values to the end, sorted alphabetically so the result
 * is stable.
 */
export function canonicalComparator(canonical: readonly string[]): (a: string, b: string) => number {
	const index = new Map(canonical.map((v, index_) => [v, index_]))
	return (a, b) => {
		const ai = index.get(a)
		const bi = index.get(b)
		if (ai != null && bi != null) return ai - bi
		if (ai != null) return -1
		if (bi != null) return 1
		return a.localeCompare(b)
	}
}
