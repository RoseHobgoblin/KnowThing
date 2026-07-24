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
		.replaceAll('<mark>', '\u0000MARK\u0000')
		.replaceAll('</mark>', '\u0000/MARK\u0000')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('\u0000MARK\u0000', '<mark>')
		.replaceAll('\u0000/MARK\u0000', '</mark>')
}

/** Extract first validation error from a Zod schema */
export function getZodValidationError(validate: ZodType | undefined, value: unknown): string {
	if (!validate) return ''
	const { error } = validate.safeParse(value)
	return error ? Object.values(z.flattenError(error).formErrors).flat().join(', ') : ''
}

function formatZodIssuePath(path: PropertyKey[]): string {
	return path
		.map((segment) => {
			if (typeof segment === 'number') return `#${segment + 1}`
			return String(segment)
				.replaceAll(/([\da-z])([A-Z])/g, '$1 $2')
				.replaceAll('_', ' ')
				.trim()
		})
		.join(' > ')
}

/** Convert Zod issues into readable, deduplicated UI messages */
export function summarizeZodIssues(error: z.ZodError): string[] {
	const seen = new Set<string>()
	const messages: string[] = []

	for (const issue of error.issues) {
		const path = formatZodIssuePath(issue.path)
		const message = path ? `${path}: ${issue.message}` : issue.message
		if (seen.has(message)) continue
		seen.add(message)
		messages.push(message)
	}

	return messages
}
