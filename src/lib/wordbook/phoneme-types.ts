// Standard IPA ordering for grid axes.
// Used as sort hints and dropdown options — grids only show values present in the data.

export const PHONEME_TYPES = ['consonant', 'vowel', 'diphthong', 'special'] as const
export type PhonemeType = (typeof PHONEME_TYPES)[number]

// Consonant places of articulation (IPA chart order, left to right)
export const CONSONANT_PLACES = [
	'bilabial',
	'labiodental',
	'dental',
	'alveolar',
	'postalveolar',
	'retroflex',
	'alveolo-palatal',
	'palatal',
	'velar',
	'uvular',
	'pharyngeal',
	'glottal',
] as const

// Consonant manners of articulation (IPA chart order, top to bottom)
export const CONSONANT_MANNERS = [
	'nasal',
	'plosive',
	'affricate',
	'fricative',
	'lateral fricative',
	'approximant',
	'lateral approximant',
	'trill',
	'tap/flap',
] as const

// Vowel heights (IPA chart order, top to bottom)
export const VOWEL_HEIGHTS = [
	'close',
	'near-close',
	'close-mid',
	'mid',
	'open-mid',
	'near-open',
	'open',
] as const

// Vowel backnesses (IPA chart order, left to right)
export const VOWEL_BACKNESSES = [
	'front',
	'near-front',
	'central',
	'near-back',
	'back',
] as const

export const VOICING_OPTIONS = ['voiceless', 'voiced'] as const

/**
 * Sort a list of values by their position in a reference ordering.
 * Unknown values sort to the end, preserving relative order.
 */
export function sortByReference(values: string[], reference: readonly string[]): string[] {
	const order = new Map(reference.map((v, i) => [v, i]))
	return [...values].sort((a, b) => {
		const ai = order.get(a) ?? Infinity
		const bi = order.get(b) ?? Infinity
		return ai - bi
	})
}
