import { describe, it, expect } from 'vitest'
import { normalizeEnvironment, createGraphemeSchema, validateReorderPayload } from '$lib/feature/wordbook/public/server/grapheme-schema.server.js'

describe('normalizeEnvironment', () => {
	it('lowercases and trims', () => {
		expect(normalizeEnvironment('Before Front Vowels')).toBe('before front vowels')
		expect(normalizeEnvironment('  word-initial  ')).toBe('word-initial')
	})

	it('collapses internal whitespace', () => {
		expect(normalizeEnvironment('before  front  vowels')).toBe('before front vowels')
	})

	it('returns null for empty or whitespace-only input', () => {
		expect(normalizeEnvironment('')).toBeNull()
		expect(normalizeEnvironment('   ')).toBeNull()
		expect(normalizeEnvironment(null)).toBeNull()
		expect(normalizeEnvironment(undefined)).toBeNull()
	})
})

describe('createGraphemeSchema', () => {
	it('requires a non-empty grapheme', () => {
		const result = createGraphemeSchema.safeParse({ grapheme: '' })
		expect(result.success).toBe(false)
	})

	it('defaults phonemeIds to empty array (silent)', () => {
		const result = createGraphemeSchema.safeParse({ grapheme: 'h' })
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.phonemeIds).toEqual([])
	})

	it('accepts an ordered phonemeIds sequence', () => {
		const result = createGraphemeSchema.safeParse({ grapheme: 'か', phonemeIds: [1, 2] })
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.phonemeIds).toEqual([1, 2])
	})

	it('rejects non-integer phoneme ids', () => {
		const result = createGraphemeSchema.safeParse({ grapheme: 'x', phonemeIds: [1.5] })
		expect(result.success).toBe(false)
	})

	it('accepts nullish optional fields', () => {
		const result = createGraphemeSchema.safeParse({
			grapheme: 'c',
			phonemeIds: [1],
			romanization: null,
			environment: null,
			notes: null,
		})
		expect(result.success).toBe(true)
	})
})

describe('validateReorderPayload', () => {
	const existing = new Set([1, 2, 3])

	it('accepts a permutation that covers every id exactly once', () => {
		expect(validateReorderPayload([3, 1, 2], existing)).toBe('ok')
		expect(validateReorderPayload([1, 2, 3], existing)).toBe('ok')
	})

	it('rejects size mismatches', () => {
		expect(validateReorderPayload([1, 2], existing)).toBe('mismatch')
		expect(validateReorderPayload([1, 2, 3, 4], existing)).toBe('mismatch')
	})

	it('rejects duplicate ids that silently omit another grapheme', () => {
		// [1,1,2] is the same length as existing and every id is a member, but
		// it leaves grapheme 3 with stale sort_order and overwrites grapheme 1
		// twice. The endpoint must reject this.
		expect(validateReorderPayload([1, 1, 2], existing)).toBe('mismatch')
	})

	it('rejects ids that don\'t belong to the language', () => {
		expect(validateReorderPayload([1, 2, 99], existing)).toBe('mismatch')
	})
})
