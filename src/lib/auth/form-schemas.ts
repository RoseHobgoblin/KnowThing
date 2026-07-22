import { z } from 'zod'

/**
 * Shared auth form schemas. Native SvelteKit-action superforms needs the schema
 * on both sides: the server action (`superValidate`) and the client
 * (`zod4Client` validators), so these live outside `$lib/server`.
 */

export const loginSchema = z.object({
	username: z.string().trim().min(1, 'Username is required'),
	password: z.string().min(1, 'Password is required'),
})
export type LoginForm = z.infer<typeof loginSchema>

export const registerSchema = z
	.object({
		username: z.string().trim().min(3, 'Username must be at least 3 characters'),
		password: z.string().min(8, 'Password must be at least 8 characters'),
		confirm: z.string().default(''),
		code: z.string().trim().default(''),
	})
	.refine(d => d.password === d.confirm, {
		message: 'Passwords do not match',
		path: ['confirm'],
	})
export type RegisterForm = z.infer<typeof registerSchema>
