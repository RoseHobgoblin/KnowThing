import { z } from 'zod'

export const LANGUAGE_TYPES = ['proto', 'language', 'historical'] as const

export const createLanguageSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	slug: z.string().min(1, 'Slug is required'),
	nativeName: z.string().nullish(),
	family: z.string().nullish(),
	script: z.string().nullish(),
	parentLanguageId: z.number().nullish(),
	languageType: z.string().nullish(),
	color: z.string().nullish(),
	pageSlug: z.string().nullish(),
	description: z.string().nullish(),
})

export const updateLanguageSchema = z.object({
	name: z.string().nullish(),
	nativeName: z.string().nullish(),
	family: z.string().nullish(),
	script: z.string().nullish(),
	parentLanguageId: z.number().nullish(),
	languageType: z.string().nullish(),
	color: z.string().nullish(),
	pageSlug: z.string().nullish(),
	description: z.string().nullish(),
})

export const createDialectSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	slug: z.string().min(1, 'Slug is required'),
	region: z.string().optional(),
	description: z.string().optional(),
})

export const updateDialectSchema = z.object({
	name: z.string().optional(),
	region: z.string().optional(),
	description: z.string().optional(),
})

export const createParadigmClassSchema = z.object({
	partOfSpeech: z.string().min(1, 'partOfSpeech is required'),
	name: z.string().min(1, 'name is required'),
	description: z.string().optional(),
})

export const updateParadigmClassSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	rules: z.array(z.object({
		cellKey: z.string(),
		pattern: z.string(),
	})).optional(),
})

export const createDimensionSchema = z.object({
	partOfSpeech: z.string().min(1, 'partOfSpeech is required'),
	name: z.string().min(1, 'name is required'),
	values: z.array(z.string()).min(1, 'values are required'),
	sortOrder: z.number().int().optional(),
})

export const updateDimensionSchema = z.object({
	name: z.string().optional(),
	values: z.array(z.string()).optional(),
	sortOrder: z.number().int().optional(),
})

export const PHONEME_TYPES = ['consonant', 'vowel', 'diphthong', 'special'] as const

export const createPhonemeSchema = z.object({
	ipa: z.string().min(1, 'IPA is required'),
	type: z.enum(PHONEME_TYPES),
	place: z.string().nullish(),
	manner: z.string().nullish(),
	subtype: z.string().nullish(),
	voicing: z.enum(['voiced', 'voiceless']).nullish(),
	height: z.string().nullish(),
	backness: z.string().nullish(),
	rounded: z.boolean().nullish(),
	marginal: z.boolean().nullish(),
	notes: z.string().nullish(),
	sortOrder: z.number().int().nullish(),
})

export const updatePhonemeSchema = z.object({
	ipa: z.string().min(1).optional(),
	type: z.enum(PHONEME_TYPES).optional(),
	place: z.string().nullish(),
	manner: z.string().nullish(),
	subtype: z.string().nullish(),
	voicing: z.enum(['voiced', 'voiceless']).nullish(),
	height: z.string().nullish(),
	backness: z.string().nullish(),
	rounded: z.boolean().nullish(),
	marginal: z.boolean().nullish(),
	notes: z.string().nullish(),
	sortOrder: z.number().int().nullish(),
})

export const updateGraphemeSchema = z.object({
	grapheme: z.string().min(1).optional(),
	phonemeIds: z.array(z.number().int()).optional(),
	romanization: z.string().nullish(),
	environment: z.string().nullish(),
	notes: z.string().nullish(),
	sortOrder: z.number().int().nullish(),
})
