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
	'noun': 'bg-blue-100 text-blue-700',
	'proper noun': 'bg-accent-light text-link',
	'verb': 'bg-green-100 text-green-700',
	'adjective': 'bg-purple-100 text-purple-700',
	'adverb': 'bg-orange-100 text-orange-700',
	'pronoun': 'bg-pink-100 text-pink-700',
	'numeral': 'bg-amber-100 text-amber-700',
	'preposition': 'bg-cyan-100 text-cyan-700',
	'postposition': 'bg-cyan-100 text-cyan-700',
	'conjunction': 'bg-yellow-100 text-yellow-700',
	'interjection': 'bg-red-100 text-red-700',
	'particle': 'bg-raised text-secondary',
	'determiner': 'bg-indigo-100 text-indigo-700',
	'article': 'bg-indigo-100 text-indigo-700',
	'classifier': 'bg-violet-100 text-violet-700',
	'prefix': 'bg-teal-100 text-teal-700',
	'suffix': 'bg-teal-100 text-teal-700',
	'infix': 'bg-teal-100 text-teal-700',
	'affix': 'bg-teal-100 text-teal-700',
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
