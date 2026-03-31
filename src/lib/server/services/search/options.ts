import { asc, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { languages, mediaCategories } from '$lib/server/db/schema.js'

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
		db
			.select({ name: languages.name, slug: languages.slug })
			.from(languages)
			.orderBy(asc(languages.name)),
		db
			.selectDistinct({ category: mediaCategories.category })
			.from(mediaCategories)
			.orderBy(asc(mediaCategories.category)),
	])

	return {
		languages: languageOptions,
		partsOfSpeech: PARTS_OF_SPEECH.map((pos) => ({ value: pos, label: titleCase(pos) })),
		mediaCategories: mediaCategoryOptions.map((row) => row.category),
	}
}

function titleCase(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1)
}
