import { describe, it, expect } from 'vitest'
import { normalizeEnvironment, createGraphemeSchema } from '../+server.js'

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
