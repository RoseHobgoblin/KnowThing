import { describe, it, expect } from 'vitest'
import { normalizeAxis } from '../+server.js'

describe('normalizeAxis', () => {
	it('lowercases and trims', () => {
		expect(normalizeAxis('Bilabial')).toBe('bilabial')
		expect(normalizeAxis('  alveolar  ')).toBe('alveolar')
	})

	it('collapses internal whitespace', () => {
		expect(normalizeAxis('alveolo  palatal')).toBe('alveolo palatal')
		expect(normalizeAxis('lateral\tapproximant')).toBe('lateral approximant')
	})

	it('returns null for empty or whitespace-only input', () => {
		expect(normalizeAxis('')).toBeNull()
		expect(normalizeAxis('   ')).toBeNull()
		expect(normalizeAxis(null)).toBeNull()
		expect(normalizeAxis(undefined)).toBeNull()
	})

	it('preserves hyphens and non-latin text', () => {
		expect(normalizeAxis('labial-velar')).toBe('labial-velar')
		expect(normalizeAxis('Alveolo-Palatal')).toBe('alveolo-palatal')
	})
})
