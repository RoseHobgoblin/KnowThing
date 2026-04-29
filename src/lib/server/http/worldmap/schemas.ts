import { z } from 'zod'

export const assignRegionsSchema = z.object({
	assignments: z.array(z.object({
		regionId: z.number().int().positive(),
		pageSlug: z.string().min(1, 'Page slug is required'),
	})).min(1, 'At least one assignment is required'),
})
