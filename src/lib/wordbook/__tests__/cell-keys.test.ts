import { describe, it, expect } from 'vitest'
import { applyPattern, cellKeyLabel, generateCellKeys } from '../cell-keys.js'

describe('generateCellKeys', () => {
	it('returns empty for no dimensions', () => {
		expect(generateCellKeys([])).toEqual([])
	})

	it('produces the cartesian product in sortOrder order', () => {
		const keys = generateCellKeys([
			{ values: ['singular', 'plural'], sortOrder: 1 },
			{ values: ['nominative', 'accusative'], sortOrder: 0 },
		])
		expect(keys).toEqual([
			'nominative.singular',
			'nominative.plural',
			'accusative.singular',
			'accusative.plural',
		])
	})

	it('handles three dimensions (grouped sections)', () => {
		const keys = generateCellKeys([
			{ values: ['a', 'b'], sortOrder: 0 },
			{ values: ['x'], sortOrder: 1 },
			{ values: ['1', '2'], sortOrder: 2 },
		])
		expect(keys).toHaveLength(4)
		expect(keys).toContain('a.x.1')
		expect(keys).toContain('b.x.2')
	})

	it('throws past the 1000-cell cap', () => {
		const eleven = Array.from({ length: 11 }, (_, index) => String(index))
		expect(() => generateCellKeys([
			{ values: eleven, sortOrder: 0 },
			{ values: eleven, sortOrder: 1 },
			{ values: eleven, sortOrder: 2 },
		])).toThrow(/Too many inflection cells/)
	})

	it('is exactly inclusive at the cap boundary', () => {
		const ten = Array.from({ length: 10 }, (_, index) => String(index))
		expect(generateCellKeys([
			{ values: ten, sortOrder: 0 },
			{ values: ten, sortOrder: 1 },
			{ values: ten, sortOrder: 2 },
		])).toHaveLength(1000)
	})
})

describe('applyPattern', () => {
	it('substitutes the stem token', () => {
		expect(applyPattern('{stem}n', 'tsida')).toBe('tsidan')
	})

	it('substitutes multiple stem tokens (reduplication)', () => {
		expect(applyPattern('{stem}-{stem}', 'kir')).toBe('kir-kir')
	})

	it('treats token-less patterns as literal irregular forms', () => {
		expect(applyPattern('went', 'go')).toBe('went')
	})

	it('supports prefixing', () => {
		expect(applyPattern('ka{stem}', 'vaom')).toBe('kavaom')
	})
})

describe('cellKeyLabel', () => {
	it('formats dot keys for display', () => {
		expect(cellKeyLabel('nominative.singular')).toBe('nominative · singular')
	})
})
