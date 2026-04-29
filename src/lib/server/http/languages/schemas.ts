import { z } from 'zod'

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
