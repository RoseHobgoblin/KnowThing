import { z } from 'zod'

/** One sense/definition row within an entry draft. */
const defRowSchema = z.object({
	partOfSpeech: z.string().default(''),
	definition: z.string().default(''),
	usageExample: z.string().default(''),
	usageTranslation: z.string().default(''),
})

export type DefRow = z.infer<typeof defRowSchema>

/** A selected etymology relation. The autocomplete's transient search state
 * (query text, results, dropdown) lives in the component, not here. */
export type EtymRelation = { targetId: number, relationType: string }

/**
 * Client-side form schema for a wordbook entry. The route handlers keep their
 * own server guards; this encodes the form's rules (word + language required,
 * at least one definition) and gives text fields string defaults for binding.
 */
export const entryFormSchema = z
	.object({
		word: z.string().min(1, 'Word is required'),
		languageId: z.number().min(1, 'Language is required').default(0),
		pronunciation: z.string().default(''),
		etymology: z.string().default(''),
		notes: z.string().default(''),
		pageSlug: z.string().default(''),
		tagsInput: z.string().default(''),
		defs: z.array(defRowSchema).default([{ partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }]),
	})
	.refine(d => d.defs.some(row => row.definition.trim().length > 0), {
		message: 'At least one definition is required',
		path: ['defs'],
	})

export type EntryFormData = z.infer<typeof entryFormSchema>

/** Normalise a validated draft (+ selected relations) into the API payload. */
export function toEntryPayload(data: EntryFormData, relations: EtymRelation[]): Record<string, unknown> {
	return {
		word: data.word.trim(),
		languageId: data.languageId,
		pronunciation: data.pronunciation.trim() || undefined,
		etymology: data.etymology.trim() || undefined,
		notes: data.notes.trim() || undefined,
		pageSlug: data.pageSlug.trim() || undefined,
		tags: data.tagsInput ? data.tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
		defs: data.defs
			.filter(d => d.definition.trim())
			.map(d => ({
				partOfSpeech: d.partOfSpeech || undefined,
				definition: d.definition.trim(),
				usageExample: d.usageExample.trim() || undefined,
				usageTranslation: d.usageTranslation.trim() || undefined,
			})),
		relations: relations.map(r => ({ targetId: r.targetId, relationType: r.relationType })),
	}
}
