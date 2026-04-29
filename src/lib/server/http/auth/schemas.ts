import { z } from 'zod'

export const createRegistrationCodeSchema = z.object({
	role: z.enum(['viewer', 'editor', 'admin']).default('editor'),
	expiresInHours: z.number().positive().optional(),
})
