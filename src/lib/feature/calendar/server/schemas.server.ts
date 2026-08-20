import { z } from 'zod'
import { staticDataSchema } from '../schema.js'

export const createCalendarSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	description: z.string().optional(),
	isPrimary: z.boolean().optional(),
	staticData: staticDataSchema,
})

export const updateCalendarSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	isPrimary: z.boolean().optional(),
	planetId: z.number().int().nullable().optional(),
	staticData: staticDataSchema.optional(),
})
