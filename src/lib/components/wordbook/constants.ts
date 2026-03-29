export const PARTS_OF_SPEECH = [
	'noun',
	'proper noun',
	'verb',
	'adjective',
	'adverb',
	'pronoun',
	'numeral',
	'preposition',
	'postposition',
	'conjunction',
	'interjection',
	'particle',
	'determiner',
	'article',
	'classifier',
	'prefix',
	'suffix',
	'infix',
	'affix',
] as const

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

export const POS_COLORS: Record<string, string> = {
	'noun': 'bg-blue-900/40 text-blue-300',
	'proper noun': 'bg-amber-900/40 text-amber-300',
	'verb': 'bg-green-900/40 text-green-300',
	'adjective': 'bg-purple-900/40 text-purple-300',
	'adverb': 'bg-orange-900/40 text-orange-300',
	'pronoun': 'bg-pink-900/40 text-pink-300',
	'numeral': 'bg-amber-900/40 text-amber-200',
	'preposition': 'bg-cyan-900/40 text-cyan-300',
	'postposition': 'bg-cyan-900/40 text-cyan-300',
	'conjunction': 'bg-yellow-900/40 text-yellow-300',
	'interjection': 'bg-red-900/40 text-red-300',
	'particle': 'bg-raised text-secondary',
	'determiner': 'bg-indigo-900/40 text-indigo-300',
	'article': 'bg-indigo-900/40 text-indigo-300',
	'classifier': 'bg-violet-900/40 text-violet-300',
	'prefix': 'bg-teal-900/40 text-teal-300',
	'suffix': 'bg-teal-900/40 text-teal-300',
	'infix': 'bg-teal-900/40 text-teal-300',
	'affix': 'bg-teal-900/40 text-teal-300',
}

/** Normalize tags: lowercase, trim, deduplicate */
export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>()
	return tags
		.map(t => t.trim().toLowerCase())
		.filter((t) => {
			if (!t || seen.has(t)) return false
			seen.add(t)
			return true
		})
}
