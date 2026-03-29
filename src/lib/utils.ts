import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z, type ZodType } from 'zod'

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs))
}

/** Extract first validation error from a Zod schema */
export function getZodValidationError(validate: ZodType | undefined, value: unknown): string {
	if (!validate) return ''
	const { error } = validate.safeParse(value)
	return error ? Object.values(z.flattenError(error).formErrors).flat().join(', ') : ''
}
