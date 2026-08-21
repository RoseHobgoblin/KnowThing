import { listMediaCategoryOptions } from '$lib/feature/media/public/server/search.server.js'
import { listWordbookLanguageOptions } from '$lib/feature/wordbook/public/server/search.server.js'

const PARTS_OF_SPEECH = [
	'noun',
	'verb',
	'adjective',
	'adverb',
	'pronoun',
	'preposition',
	'postposition',
	'conjunction',
	'interjection',
	'particle',
] as const

export async function loadSearchFilterOptions() {
	const [languageOptions, mediaCategoryOptions] = await Promise.all([
		listWordbookLanguageOptions(),
		listMediaCategoryOptions(),
	])

	return {
		languages: languageOptions,
		partsOfSpeech: PARTS_OF_SPEECH.map(pos => ({ value: pos, label: titleCase(pos) })),
		mediaCategories: mediaCategoryOptions,
	}
}

function titleCase(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1)
}
