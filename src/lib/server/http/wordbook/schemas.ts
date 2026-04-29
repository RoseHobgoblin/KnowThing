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
