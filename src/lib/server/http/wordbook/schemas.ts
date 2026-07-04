import { z } from 'zod'

export const createWordSchema = z.object({
	word: z.string().min(1, 'Word is required'),
	languageId: z.number({ error: 'Language is required' }),
	pronunciation: z.string().optional(),
	etymology: z.string().optional(),
	notes: z.string().optional(),
	pageSlug: z.string().optional(),
	tags: z.array(z.string()).optional(),
	defs: z.array(z.object({
		partOfSpeech: z.string().optional(),
		definition: z.string(),
		usageExample: z.string().optional(),
		usageTranslation: z.string().optional(),
	})).optional(),
	relations: z.array(z.object({
		targetId: z.number(),
		relationType: z.string(),
	})).optional(),
	definition: z.string().optional(),
	isHomograph: z.boolean().optional(),
})

export const updateWordSchema = z.object({
	word: z.string().optional(),
	languageId: z.number().optional(),
	pronunciation: z.string().optional(),
	etymology: z.string().optional(),
	notes: z.string().optional(),
	pageSlug: z.string().optional(),
	tags: z.array(z.string()).optional(),
})

const definitionFields = {
	partOfSpeech: z.string().optional(),
	usageExample: z.string().optional(),
	usageTranslation: z.string().optional(),
}

export const addDefinitionSchema = z.object({
	...definitionFields,
	definition: z.string().trim().min(1, 'Definition is required'),
})

export const replaceDefinitionsSchema = z.object({
	defs: z.array(z.object({
		...definitionFields,
		definition: z.string(),
	})).min(1, 'At least one definition is required')
		.refine(defs => defs.some(d => d.definition.trim()), 'At least one definition must be non-empty'),
})

export const updateDefinitionSchema = z.object({
	...definitionFields,
	definition: z.string().optional(),
})

export const addVariantSchema = z.object({
	dialectId: z.number().int('dialectId must be an integer'),
	pronunciation: z.string().optional(),
	spelling: z.string().optional(),
	notes: z.string().optional(),
}).refine(v => v.pronunciation?.trim() || v.spelling?.trim(), 'A pronunciation or spelling is required')

export const RELATION_TYPES = ['derived_from', 'loan_from', 'compound_of'] as const

export const addRelationSchema = z.object({
	targetId: z.number().int('targetId must be an integer'),
	relationType: z.enum(RELATION_TYPES),
	notes: z.string().optional(),
})

export const updateInflectionSchema = z.object({
	classId: z.number().int().nullish(),
	stem: z.string().nullish(),
	overrides: z.record(z.string(), z.string()).optional(),
})
