import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	definitions,
	graphemePhonemes,
	graphemes,
	languageDialects,
	languages,
	lexicon,
	phonemes,
} from '../../server/schema.server.js'
import type {
	StructuredCollection,
	StructuredCollectionProvider,
	StructuredDataProvider,
} from '$lib/structured-data/providers.js'

async function resolveLanguage(identifier: string) {
	const [language] = await db.select().from(languages).where(eq(languages.slug, identifier.toLowerCase()))
	if (!language) return null

	const fields = new Map<string, string>([['name', language.name]])
	if (language.nativeName) fields.set('nativename', language.nativeName)
	if (language.script) fields.set('script', language.script)
	if (language.family) fields.set('family', language.family)
	if (language.color) fields.set('familycolor', language.color)

	const ancestors: string[] = []
	let parentId = language.parentLanguageId
	for (let depth = 0; parentId != null && depth < 10; depth++) {
		const [parent] = await db
			.select({
				id: languages.id,
				name: languages.name,
				slug: languages.slug,
				parentLanguageId: languages.parentLanguageId,
				family: languages.family,
			})
			.from(languages)
			.where(eq(languages.id, parentId))
		if (!parent) break
		ancestors.unshift(`[[Wordbook/${parent.slug}|${parent.name}]]`)
		if (!fields.has('family') && parent.family) fields.set('family', parent.family)
		parentId = parent.parentLanguageId
	}
	for (const [index, ancestor] of ancestors.entries()) fields.set(`ancestor${index + 1}`, ancestor)
	if (ancestors.length > 0 && language.languageType !== 'proto') {
		fields.set('protoname', ancestors[0].replace(/\[\[[^|]*\|([^\]]*)]]/, '$1'))
	}

	const dialects = await db
		.select({ name: languageDialects.name })
		.from(languageDialects)
		.where(eq(languageDialects.languageId, language.id))
	for (const [index, dialect] of dialects.entries()) fields.set(`ld${index + 1}`, dialect.name)
	return fields
}

async function resolveWord(identifier: string) {
	const [languageSlug, ...wordParts] = identifier.split(':')
	const word = wordParts.join(':').trim()
	if (!languageSlug || !word) return null
	const [language] = await db
		.select({ id: languages.id, name: languages.name, slug: languages.slug })
		.from(languages)
		.where(eq(languages.slug, languageSlug.toLowerCase()))
	if (!language) return null
	const [entry] = await db
		.select()
		.from(lexicon)
		.where(and(eq(lexicon.languageId, language.id), sql`LOWER(${lexicon.word}) = LOWER(${word})`))
		.orderBy(asc(lexicon.homographNumber))
	if (!entry) return null

	const fields = new Map<string, string>([
		['name', entry.word],
		['language', `[[Wordbook/${language.slug}|${language.name}]]`],
	])
	if (entry.pronunciation) fields.set('pronunciation', entry.pronunciation)
	if (entry.etymology) fields.set('etymology', entry.etymology)
	if (entry.tags?.length) fields.set('tags', entry.tags.join(', '))
	const entryDefinitions = await db
		.select({ partOfSpeech: definitions.partOfSpeech, definition: definitions.definition })
		.from(definitions)
		.where(eq(definitions.entryId, entry.id))
		.orderBy(asc(definitions.senseNumber))
	if (entryDefinitions.length > 0) {
		if (entryDefinitions[0].partOfSpeech) fields.set('part_of_speech', entryDefinitions[0].partOfSpeech)
		fields.set('definition', entryDefinitions
			.map((definition, index) => entryDefinitions.length > 1 ? `${index + 1}. ${definition.definition}` : definition.definition)
			.join('<br>'))
	}
	return fields
}

export const wordbookStructuredDataProviders: StructuredDataProvider[] = [
	{ kind: 'language', resolve: resolveLanguage },
	{ kind: 'conlang', resolve: resolveLanguage },
	{ kind: 'word', resolve: resolveWord },
]

async function loadPhonemes(identifier: string, phonemeType: 'consonant' | 'vowel' | 'diphthong') {
	const [language] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, identifier))
	if (!language) return null
	return db
		.select()
		.from(phonemes)
		.where(and(eq(phonemes.languageId, language.id), eq(phonemes.type, phonemeType)))
		.orderBy(asc(phonemes.sortOrder), asc(phonemes.id)) as Promise<StructuredCollection>
}

async function loadOrthography(identifier: string): Promise<StructuredCollection | null> {
	const [language] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, identifier))
	if (!language) return null
	const rows = await db
		.select({
			id: graphemes.id,
			grapheme: graphemes.grapheme,
			romanization: graphemes.romanization,
			environment: graphemes.environment,
			notes: graphemes.notes,
			sortOrder: graphemes.sortOrder,
		})
		.from(graphemes)
		.where(eq(graphemes.languageId, language.id))
		.orderBy(asc(graphemes.sortOrder), asc(graphemes.id))
	if (rows.length === 0) return []
	const links = await db
		.select({
			graphemeId: graphemePhonemes.graphemeId,
			position: graphemePhonemes.position,
			ipa: phonemes.ipa,
			type: phonemes.type,
		})
		.from(graphemePhonemes)
		.innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
		.where(inArray(graphemePhonemes.graphemeId, rows.map(row => row.id)))
		.orderBy(asc(graphemePhonemes.graphemeId), asc(graphemePhonemes.position))
	const linksByGrapheme = new Map<number, { ipa: string, type: string }[]>()
	for (const link of links) {
		const values = linksByGrapheme.get(link.graphemeId) ?? []
		values.push({ ipa: link.ipa, type: link.type })
		linksByGrapheme.set(link.graphemeId, values)
	}
	return rows.map(row => ({ ...row, phonemes: linksByGrapheme.get(row.id) ?? [] }))
}

export const wordbookStructuredCollectionProviders: StructuredCollectionProvider[] = [
	{ kind: 'consonants', resolve: identifier => loadPhonemes(identifier, 'consonant') },
	{ kind: 'vowels', resolve: identifier => loadPhonemes(identifier, 'vowel') },
	{ kind: 'diphthongs', resolve: identifier => loadPhonemes(identifier, 'diphthong') },
	{ kind: 'orthography', resolve: loadOrthography },
]
