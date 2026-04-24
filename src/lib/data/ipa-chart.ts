// Static IPA feature lookup. Drives the phoneme editor's IPA picker: click a
// symbol, features auto-populate. All values are freeform text strings matching
// the phonemes table columns, so the user can edit any of them afterward
// without breaking the grid renderer (which derives axes from data).

export type PhonemeType = 'consonant' | 'vowel' | 'diphthong' | 'special'

export interface IpaEntry {
	symbol: string
	type: PhonemeType
	place?: string
	manner?: string
	voicing?: 'voiced' | 'voiceless'
	height?: string
	backness?: string
	rounded?: boolean
	subtype?: string
}

export interface IpaSection {
	id: string
	label: string
	/** Optional grid layout for rendering the chart. Columns and rows are the
	 * feature values used as axes; entries are placed by (row, col). */
	columns?: string[]
	rows?: string[]
	entries: IpaEntry[]
}

const pulmonic: IpaEntry[] = [
	// bilabial
	{ symbol: 'p', type: 'consonant', place: 'bilabial', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'b', type: 'consonant', place: 'bilabial', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'm', type: 'consonant', place: 'bilabial', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'ʙ', type: 'consonant', place: 'bilabial', manner: 'trill', voicing: 'voiced' },
	{ symbol: 'ɸ', type: 'consonant', place: 'bilabial', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'β', type: 'consonant', place: 'bilabial', manner: 'fricative', voicing: 'voiced' },
	// labiodental
	{ symbol: 'ɱ', type: 'consonant', place: 'labiodental', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'ⱱ', type: 'consonant', place: 'labiodental', manner: 'tap', voicing: 'voiced' },
	{ symbol: 'f', type: 'consonant', place: 'labiodental', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'v', type: 'consonant', place: 'labiodental', manner: 'fricative', voicing: 'voiced' },
	{ symbol: 'ʋ', type: 'consonant', place: 'labiodental', manner: 'approximant', voicing: 'voiced' },
	// dental
	{ symbol: 'θ', type: 'consonant', place: 'dental', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ð', type: 'consonant', place: 'dental', manner: 'fricative', voicing: 'voiced' },
	// alveolar
	{ symbol: 't', type: 'consonant', place: 'alveolar', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'd', type: 'consonant', place: 'alveolar', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'n', type: 'consonant', place: 'alveolar', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'r', type: 'consonant', place: 'alveolar', manner: 'trill', voicing: 'voiced' },
	{ symbol: 'ɾ', type: 'consonant', place: 'alveolar', manner: 'tap', voicing: 'voiced' },
	{ symbol: 's', type: 'consonant', place: 'alveolar', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'z', type: 'consonant', place: 'alveolar', manner: 'fricative', voicing: 'voiced' },
	{ symbol: 'ɬ', type: 'consonant', place: 'alveolar', manner: 'lateral fricative', voicing: 'voiceless' },
	{ symbol: 'ɮ', type: 'consonant', place: 'alveolar', manner: 'lateral fricative', voicing: 'voiced' },
	{ symbol: 'ɹ', type: 'consonant', place: 'alveolar', manner: 'approximant', voicing: 'voiced' },
	{ symbol: 'l', type: 'consonant', place: 'alveolar', manner: 'lateral approximant', voicing: 'voiced' },
	// postalveolar
	{ symbol: 'ʃ', type: 'consonant', place: 'postalveolar', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ʒ', type: 'consonant', place: 'postalveolar', manner: 'fricative', voicing: 'voiced' },
	// retroflex
	{ symbol: 'ʈ', type: 'consonant', place: 'retroflex', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'ɖ', type: 'consonant', place: 'retroflex', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'ɳ', type: 'consonant', place: 'retroflex', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'ɽ', type: 'consonant', place: 'retroflex', manner: 'tap', voicing: 'voiced' },
	{ symbol: 'ʂ', type: 'consonant', place: 'retroflex', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ʐ', type: 'consonant', place: 'retroflex', manner: 'fricative', voicing: 'voiced' },
	{ symbol: 'ɻ', type: 'consonant', place: 'retroflex', manner: 'approximant', voicing: 'voiced' },
	{ symbol: 'ɭ', type: 'consonant', place: 'retroflex', manner: 'lateral approximant', voicing: 'voiced' },
	// palatal
	{ symbol: 'c', type: 'consonant', place: 'palatal', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'ɟ', type: 'consonant', place: 'palatal', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'ɲ', type: 'consonant', place: 'palatal', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'ç', type: 'consonant', place: 'palatal', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ʝ', type: 'consonant', place: 'palatal', manner: 'fricative', voicing: 'voiced' },
	{ symbol: 'j', type: 'consonant', place: 'palatal', manner: 'approximant', voicing: 'voiced' },
	{ symbol: 'ʎ', type: 'consonant', place: 'palatal', manner: 'lateral approximant', voicing: 'voiced' },
	// velar
	{ symbol: 'k', type: 'consonant', place: 'velar', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'ɡ', type: 'consonant', place: 'velar', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'ŋ', type: 'consonant', place: 'velar', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'x', type: 'consonant', place: 'velar', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ɣ', type: 'consonant', place: 'velar', manner: 'fricative', voicing: 'voiced' },
	{ symbol: 'ɰ', type: 'consonant', place: 'velar', manner: 'approximant', voicing: 'voiced' },
	{ symbol: 'ʟ', type: 'consonant', place: 'velar', manner: 'lateral approximant', voicing: 'voiced' },
	// uvular
	{ symbol: 'q', type: 'consonant', place: 'uvular', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'ɢ', type: 'consonant', place: 'uvular', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'ɴ', type: 'consonant', place: 'uvular', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'ʀ', type: 'consonant', place: 'uvular', manner: 'trill', voicing: 'voiced' },
	{ symbol: 'χ', type: 'consonant', place: 'uvular', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ʁ', type: 'consonant', place: 'uvular', manner: 'fricative', voicing: 'voiced' },
	// pharyngeal
	{ symbol: 'ħ', type: 'consonant', place: 'pharyngeal', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ʕ', type: 'consonant', place: 'pharyngeal', manner: 'fricative', voicing: 'voiced' },
	// glottal
	{ symbol: 'ʔ', type: 'consonant', place: 'glottal', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'h', type: 'consonant', place: 'glottal', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ɦ', type: 'consonant', place: 'glottal', manner: 'fricative', voicing: 'voiced' },
]

const affricates: IpaEntry[] = [
	{ symbol: 't͡s', type: 'consonant', place: 'alveolar', manner: 'affricate', voicing: 'voiceless' },
	{ symbol: 'd͡z', type: 'consonant', place: 'alveolar', manner: 'affricate', voicing: 'voiced' },
	{ symbol: 't͡ʃ', type: 'consonant', place: 'postalveolar', manner: 'affricate', voicing: 'voiceless' },
	{ symbol: 'd͡ʒ', type: 'consonant', place: 'postalveolar', manner: 'affricate', voicing: 'voiced' },
	{ symbol: 'ʈ͡ʂ', type: 'consonant', place: 'retroflex', manner: 'affricate', voicing: 'voiceless' },
	{ symbol: 'ɖ͡ʐ', type: 'consonant', place: 'retroflex', manner: 'affricate', voicing: 'voiced' },
	{ symbol: 't͡ɕ', type: 'consonant', place: 'alveolo-palatal', manner: 'affricate', voicing: 'voiceless' },
	{ symbol: 'd͡ʑ', type: 'consonant', place: 'alveolo-palatal', manner: 'affricate', voicing: 'voiced' },
	{ symbol: 'p͡f', type: 'consonant', place: 'labiodental', manner: 'affricate', voicing: 'voiceless' },
	{ symbol: 'b͡v', type: 'consonant', place: 'labiodental', manner: 'affricate', voicing: 'voiced' },
	{ symbol: 'k͡x', type: 'consonant', place: 'velar', manner: 'affricate', voicing: 'voiceless' },
	{ symbol: 'ɡ͡ɣ', type: 'consonant', place: 'velar', manner: 'affricate', voicing: 'voiced' },
	// alveolo-palatal fricatives (commonly referenced near affricates)
	{ symbol: 'ɕ', type: 'consonant', place: 'alveolo-palatal', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ʑ', type: 'consonant', place: 'alveolo-palatal', manner: 'fricative', voicing: 'voiced' },
]

const nonPulmonic: IpaEntry[] = [
	// clicks (voiceless by default)
	{ symbol: 'ʘ', type: 'consonant', place: 'bilabial', manner: 'click', voicing: 'voiceless' },
	{ symbol: 'ǀ', type: 'consonant', place: 'dental', manner: 'click', voicing: 'voiceless' },
	{ symbol: 'ǃ', type: 'consonant', place: 'alveolar', manner: 'click', voicing: 'voiceless' },
	{ symbol: 'ǂ', type: 'consonant', place: 'palatal', manner: 'click', voicing: 'voiceless' },
	{ symbol: 'ǁ', type: 'consonant', place: 'alveolar', manner: 'lateral click', voicing: 'voiceless' },
	// implosives (voiced by default)
	{ symbol: 'ɓ', type: 'consonant', place: 'bilabial', manner: 'implosive', voicing: 'voiced' },
	{ symbol: 'ɗ', type: 'consonant', place: 'alveolar', manner: 'implosive', voicing: 'voiced' },
	{ symbol: 'ʄ', type: 'consonant', place: 'palatal', manner: 'implosive', voicing: 'voiced' },
	{ symbol: 'ɠ', type: 'consonant', place: 'velar', manner: 'implosive', voicing: 'voiced' },
	{ symbol: 'ʛ', type: 'consonant', place: 'uvular', manner: 'implosive', voicing: 'voiced' },
	// ejectives
	{ symbol: 'pʼ', type: 'consonant', place: 'bilabial', manner: 'ejective', voicing: 'voiceless' },
	{ symbol: 'tʼ', type: 'consonant', place: 'alveolar', manner: 'ejective', voicing: 'voiceless' },
	{ symbol: 'kʼ', type: 'consonant', place: 'velar', manner: 'ejective', voicing: 'voiceless' },
	{ symbol: 'sʼ', type: 'consonant', place: 'alveolar', manner: 'ejective fricative', voicing: 'voiceless' },
	{ symbol: 'qʼ', type: 'consonant', place: 'uvular', manner: 'ejective', voicing: 'voiceless' },
]

const coArticulated: IpaEntry[] = [
	{ symbol: 'w', type: 'consonant', place: 'labial-velar', manner: 'approximant', voicing: 'voiced' },
	{ symbol: 'ʍ', type: 'consonant', place: 'labial-velar', manner: 'fricative', voicing: 'voiceless' },
	{ symbol: 'ɥ', type: 'consonant', place: 'labial-palatal', manner: 'approximant', voicing: 'voiced' },
	{ symbol: 'ɫ', type: 'consonant', place: 'alveolar', manner: 'lateral approximant', voicing: 'voiced', subtype: 'velarized' },
	{ symbol: 'k͡p', type: 'consonant', place: 'labial-velar', manner: 'plosive', voicing: 'voiceless' },
	{ symbol: 'ɡ͡b', type: 'consonant', place: 'labial-velar', manner: 'plosive', voicing: 'voiced' },
	{ symbol: 'ŋ͡m', type: 'consonant', place: 'labial-velar', manner: 'nasal', voicing: 'voiced' },
	{ symbol: 'ɕ͡ɧ', type: 'consonant', place: 'dorso-palatal-velar', manner: 'fricative', voicing: 'voiceless' },
]

const vowels: IpaEntry[] = [
	// close
	{ symbol: 'i', type: 'vowel', height: 'close', backness: 'front', rounded: false },
	{ symbol: 'y', type: 'vowel', height: 'close', backness: 'front', rounded: true },
	{ symbol: 'ɨ', type: 'vowel', height: 'close', backness: 'central', rounded: false },
	{ symbol: 'ʉ', type: 'vowel', height: 'close', backness: 'central', rounded: true },
	{ symbol: 'ɯ', type: 'vowel', height: 'close', backness: 'back', rounded: false },
	{ symbol: 'u', type: 'vowel', height: 'close', backness: 'back', rounded: true },
	// near-close
	{ symbol: 'ɪ', type: 'vowel', height: 'near-close', backness: 'front', rounded: false },
	{ symbol: 'ʏ', type: 'vowel', height: 'near-close', backness: 'front', rounded: true },
	{ symbol: 'ʊ', type: 'vowel', height: 'near-close', backness: 'back', rounded: true },
	// close-mid
	{ symbol: 'e', type: 'vowel', height: 'close-mid', backness: 'front', rounded: false },
	{ symbol: 'ø', type: 'vowel', height: 'close-mid', backness: 'front', rounded: true },
	{ symbol: 'ɘ', type: 'vowel', height: 'close-mid', backness: 'central', rounded: false },
	{ symbol: 'ɵ', type: 'vowel', height: 'close-mid', backness: 'central', rounded: true },
	{ symbol: 'ɤ', type: 'vowel', height: 'close-mid', backness: 'back', rounded: false },
	{ symbol: 'o', type: 'vowel', height: 'close-mid', backness: 'back', rounded: true },
	// mid
	{ symbol: 'ə', type: 'vowel', height: 'mid', backness: 'central', rounded: false },
	// open-mid
	{ symbol: 'ɛ', type: 'vowel', height: 'open-mid', backness: 'front', rounded: false },
	{ symbol: 'œ', type: 'vowel', height: 'open-mid', backness: 'front', rounded: true },
	{ symbol: 'ɜ', type: 'vowel', height: 'open-mid', backness: 'central', rounded: false },
	{ symbol: 'ɞ', type: 'vowel', height: 'open-mid', backness: 'central', rounded: true },
	{ symbol: 'ʌ', type: 'vowel', height: 'open-mid', backness: 'back', rounded: false },
	{ symbol: 'ɔ', type: 'vowel', height: 'open-mid', backness: 'back', rounded: true },
	// near-open
	{ symbol: 'æ', type: 'vowel', height: 'near-open', backness: 'front', rounded: false },
	{ symbol: 'ɐ', type: 'vowel', height: 'near-open', backness: 'central', rounded: false },
	// open
	{ symbol: 'a', type: 'vowel', height: 'open', backness: 'front', rounded: false },
	{ symbol: 'ɶ', type: 'vowel', height: 'open', backness: 'front', rounded: true },
	{ symbol: 'ä', type: 'vowel', height: 'open', backness: 'central', rounded: false },
	{ symbol: 'ɑ', type: 'vowel', height: 'open', backness: 'back', rounded: false },
	{ symbol: 'ɒ', type: 'vowel', height: 'open', backness: 'back', rounded: true },
]

const diphthongs: IpaEntry[] = [
	{ symbol: 'aɪ', type: 'diphthong' },
	{ symbol: 'aʊ', type: 'diphthong' },
	{ symbol: 'eɪ', type: 'diphthong' },
	{ symbol: 'oʊ', type: 'diphthong' },
	{ symbol: 'ɔɪ', type: 'diphthong' },
	{ symbol: 'ɪə', type: 'diphthong' },
	{ symbol: 'eə', type: 'diphthong' },
	{ symbol: 'ʊə', type: 'diphthong' },
]

export const IPA_SECTIONS: IpaSection[] = [
	{
		id: 'pulmonic',
		label: 'Pulmonic consonants',
		columns: ['bilabial', 'labiodental', 'dental', 'alveolar', 'postalveolar', 'retroflex', 'palatal', 'velar', 'uvular', 'pharyngeal', 'glottal'],
		rows: ['plosive', 'nasal', 'trill', 'tap', 'fricative', 'lateral fricative', 'approximant', 'lateral approximant'],
		entries: pulmonic,
	},
	{
		id: 'affricates',
		label: 'Affricates',
		entries: affricates,
	},
	{
		id: 'non-pulmonic',
		label: 'Non-pulmonic consonants',
		entries: nonPulmonic,
	},
	{
		id: 'co-articulated',
		label: 'Co-articulated consonants',
		entries: coArticulated,
	},
	{
		id: 'vowels',
		label: 'Vowels',
		columns: ['front', 'central', 'back'],
		rows: ['close', 'near-close', 'close-mid', 'mid', 'open-mid', 'near-open', 'open'],
		entries: vowels,
	},
	{
		id: 'diphthongs',
		label: 'Diphthongs',
		entries: diphthongs,
	},
]

/** Flat map of every IPA symbol to its feature entry. */
export const IPA_LOOKUP: Map<string, IpaEntry> = new Map(
	IPA_SECTIONS.flatMap(s => s.entries.map(e => [e.symbol, e] as const)),
)

export function lookupIpa(symbol: string): IpaEntry | undefined {
	return IPA_LOOKUP.get(symbol)
}
