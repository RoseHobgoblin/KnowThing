import { describe, expect, it } from 'vitest'
import { resolveParserFunction } from '../magic-words.js'

function expr(input: string): string | null {
	return resolveParserFunction('#expr', [{ name: null, value: input }])
}

describe('#expr', () => {
	it('evaluates the four operators with precedence', () => {
		expect(expr('1 + 2')).toBe('3')
		expect(expr('2 + 3 * 4')).toBe('14')
		expect(expr('10 - 2 - 3')).toBe('5')
		expect(expr('10 / 4')).toBe('2.5')
	})

	it('honours parentheses and unary signs', () => {
		expect(expr('(2 + 3) * 4')).toBe('20')
		expect(expr('-5 + 2')).toBe('-3')
		expect(expr('3 * -2')).toBe('-6')
		expect(expr('--4')).toBe('4')
	})

	it('parses decimals with and without a leading digit', () => {
		expect(expr('1.5 * 2')).toBe('3')
		expect(expr('.5 + .25')).toBe('0.75')
	})

	it('treats an empty expression as zero', () => {
		expect(expr('')).toBe('0')
		expect(expr('   ')).toBe('0')
	})

	it('rejects malformed input instead of guessing', () => {
		expect(expr('1 +')).toBe('Expression error')
		expect(expr('(1 + 2')).toBe('Expression error')
		expect(expr('1 2')).toBe('Expression error')
		expect(expr('2 mod 3')).toBe('Expression error')
	})

	it('does not evaluate arbitrary JavaScript', () => {
		expect(expr('globalThis')).toBe('Expression error')
		expect(expr('(()=>1)()')).toBe('Expression error')
		expect(expr('[].constructor')).toBe('Expression error')
	})
})
