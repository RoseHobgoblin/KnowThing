import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z, type ZodType } from 'zod'

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs))
}

/** Allow only <mark> tags from ts_headline, escape everything else */
export function sanitizeSnippet(html: string): string {
	return html
		.replace(/<mark>/g, '\x00MARK\x00')
		.replace(/<\/mark>/g, '\x00/MARK\x00')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\x00MARK\x00/g, '<mark>')
		.replace(/\x00\/MARK\x00/g, '</mark>')
}

/** Extract first validation error from a Zod schema */
export function getZodValidationError(validate: ZodType | undefined, value: unknown): string {
	if (!validate) return ''
	const { error } = validate.safeParse(value)
	return error ? Object.values(z.flattenError(error).formErrors).flat().join(', ') : ''
}
