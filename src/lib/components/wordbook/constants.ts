export const PARTS_OF_SPEECH = [
	'noun',
	'verb',
	'adjective',
	'adverb',
	'pronoun',
	'preposition',
	'conjunction',
	'interjection',
	'particle',
	'determiner',
	'prefix',
	'suffix',
	'proper noun'
] as const;

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export const POS_COLORS: Record<string, string> = {
	noun: 'bg-blue-100 text-blue-700',
	verb: 'bg-green-100 text-green-700',
	adjective: 'bg-purple-100 text-purple-700',
	adverb: 'bg-orange-100 text-orange-700',
	pronoun: 'bg-pink-100 text-pink-700',
	preposition: 'bg-cyan-100 text-cyan-700',
	conjunction: 'bg-yellow-100 text-yellow-700',
	interjection: 'bg-red-100 text-red-700',
	particle: 'bg-stone-100 text-stone-700',
	determiner: 'bg-indigo-100 text-indigo-700',
	prefix: 'bg-teal-100 text-teal-700',
	suffix: 'bg-teal-100 text-teal-700',
	'proper noun': 'bg-amber-100 text-amber-700'
};

/** Normalize tags: lowercase, trim, deduplicate */
export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	return tags
		.map((t) => t.trim().toLowerCase())
		.filter((t) => {
			if (!t || seen.has(t)) return false;
			seen.add(t);
			return true;
		});
}
