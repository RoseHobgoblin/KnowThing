import { describe, expect, it } from 'vitest'
import { convert } from './convert.js'

describe('convert', () => {
	it('converts metric length to imperial by default', () => {
		const r = convert(10, 'km')
		expect(r.target?.unit).toBe('mi')
		expect(r.target?.value).toBe('6.21')
	})

	it('honors explicit target unit', () => {
		const r = convert(1, 'mi', 'km')
		expect(r.target?.unit).toBe('km')
		expect(r.target?.value).toBe('1.61')
	})

	it('rejects cross-kind conversion', () => {
		const r = convert(1, 'kg', 'm')
		expect(r.target).toBeNull()
	})

	it('handles unicode area unit input', () => {
		const r = convert(5, 'km²', 'sq mi')
		expect(r.source.unit).toBe('km²')
		expect(r.target?.unit).toBe('sq mi')
	})

	it('converts temperature with offset', () => {
		const r = convert(0, '°C', '°F')
		expect(r.target?.value).toBe('32.0')

		const r2 = convert(0, 'C', 'K', 2)
		expect(r2.target?.value).toBe('273.15')
	})

	it('returns null target for unknown source unit', () => {
		const r = convert(5, 'parsec')
		expect(r.target).toBeNull()
		expect(r.source.unit).toBe('parsec')
	})

	it('honors explicit precision', () => {
		const r = convert(1, 'mi', 'km', 4)
		expect(r.target?.value).toBe('1.6093')
	})
})
