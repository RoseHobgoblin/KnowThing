import { z } from 'zod'


/** Environment strings are free-form but normalized to avoid accidental
 * divergence ("Before Front Vowels" vs "before front vowels"). Identical rules
 * to phoneme-axis normalization, so it reuses normalizeAxis. */


export const createGraphemeSchema = z.object({
	grapheme: z.string().min(1, 'Grapheme is required'),
	phonemeIds: z.array(z.number().int()).default([]),
	romanization: z.string().nullish(),
	environment: z.string().nullish(),
	notes: z.string().nullish(),
	sortOrder: z.number().int().nullish(),
})

/** Reject any reorder payload that doesn't cover the language's graphemes
 * exactly: size mismatch, duplicate ids, or unknown ids. The duplicate-id
 * check is the subtle one — `[1,1,2]` passes length+membership but silently
 * leaves another grapheme's sort_order untouched. */
export function validateReorderPayload(order: number[], existingIds: Set<number>): 'ok' | 'mismatch' {
	if (order.length !== existingIds.size) return 'mismatch'
	if (new Set(order).size !== order.length) return 'mismatch'
	for (const id of order) if (!existingIds.has(id)) return 'mismatch'
	return 'ok'
}

export { normalizeAxis as normalizeEnvironment } from '$lib/server/utils.js'
