import { z } from 'zod'

export const createPageSchema = z.object({
	title: z.string().min(1, 'Title is required'),
	content: z.string(),
	slug: z.string().optional(),
})

export const updatePageSchema = z.object({
	content: z.string(),
	title: z.string().min(1).optional(),
	editSummary: z.string().optional(),
})

export const movePageSchema = z.object({
	newSlug: z.string().min(1, 'newSlug is required'),
	newTitle: z.string().optional(),
})
