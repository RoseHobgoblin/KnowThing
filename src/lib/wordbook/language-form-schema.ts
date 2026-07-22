import { z } from 'zod'

export const LANGUAGE_TYPES = ['language', 'proto', 'historical'] as const
export type LanguageType = typeof LANGUAGE_TYPES[number]

/**
 * Client-side form schema for creating/editing a language. Deliberately richer
 * than the server API guard (`createLanguageSchema` in `$lib/server`, which the
 * route handlers still enforce): it encodes form-only rules — the proto-language
 * family requirement — and gives text fields string defaults so they bind
 * cleanly to inputs. The server schema remains the trust boundary.
 */
export const languageFormSchema = z
	.object({
		name: z.string().min(1, 'Name is required'),
		slug: z.string().min(1, 'Slug is required'),
		nativeName: z.string().default(''),
		script: z.string().default('Latin'),
		family: z.string().default(''),
		color: z.string().default('var(--color-accent)'),
		description: z.string().default(''),
		pageSlug: z.string().default(''),
		parentLanguageId: z.number().nullable().default(null),
		languageType: z.enum(LANGUAGE_TYPES).default('language'),
	})
	.refine(d => d.languageType !== 'proto' || d.family.trim().length > 0, {
		message: 'Family is required for proto-languages',
		path: ['family'],
	})

export type LanguageFormData = z.infer<typeof languageFormSchema>

/** Normalise a validated draft into the API payload (trim, empty → null). */
export function toLanguagePayload(data: LanguageFormData): Record<string, unknown> {
	return {
		name: data.name.trim(),
		slug: data.slug.trim(),
		nativeName: data.nativeName.trim() || null,
		script: data.script.trim() || 'Latin',
		family: data.family.trim() || null,
		color: data.color || 'var(--color-accent)',
		description: data.description.trim() || null,
		pageSlug: data.pageSlug.trim() || null,
		parentLanguageId: data.parentLanguageId || null,
		languageType: data.languageType,
	}
}
