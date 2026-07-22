import { describe, it, expect } from 'vitest'
import { deriveBody, deriveStar } from './models.js'

const EARTH = { name: 'Earth', slug: 'earth', massKg: 5.972e24, radiusM: 6.371e6, semiMajorAxisAu: 1, eccentricity: 0.0167, rotationPeriodS: 86_164 }
const SUN = { name: 'Sun', slug: 'the-sun', massKg: 1.989e30, radiusM: 6.9634e8, temperatureK: 5778 }

describe('deriveBody', () => {
	it('computes physical quantities in SI (not strings)', () => {
		const m = deriveBody(EARTH, { star: { name: 'Sun', slug: 'the-sun', massKg: SUN.massKg } })
		expect(m.densityKgM3).toBeCloseTo(5514, -2)
		expect(m.gravityMs2).toBeCloseTo(9.8, 1)
		expect(m.escapeVelocityMs! / 1000).toBeCloseTo(11.19, 1)
		expect(typeof m.gravityMs2).toBe('number')
	})

	it('derives the orbital period from the star mass when not stored', () => {
		const m = deriveBody(EARTH, { star: { name: 'Sun', slug: 'the-sun', massKg: SUN.massKg } })
		expect(m.orbitalPeriodDays).toBeCloseTo(365, 0)
	})

	it('a moon orbits its parent body, so satelliteOf is the body and period uses the body mass', () => {
		const luna = { name: 'Luna', slug: 'luna', massKg: 7.35e22, radiusM: 1.737e6, semiMajorAxisAu: 0.00257 }
		const m = deriveBody(luna, {
			star: { name: 'Sun', slug: 'the-sun', massKg: SUN.massKg },
			parentBody: { name: 'Earth', slug: 'earth', massKg: EARTH.massKg },
		})
		expect(m.satelliteOf?.slug).toBe('earth')
		// ~27 days around Earth, NOT ~year around the Sun
		expect(m.orbitalPeriodDays!).toBeGreaterThan(20)
		expect(m.orbitalPeriodDays!).toBeLessThan(40)
	})

	it('a planet with no parent body orbits the star', () => {
		const m = deriveBody(EARTH, { star: { name: 'Sun', slug: 'the-sun', massKg: SUN.massKg } })
		expect(m.satelliteOf?.slug).toBe('the-sun')
	})

	it('a circumbinary body orbits the system barycenter using the total stellar mass', () => {
		const m = deriveBody(EARTH, { system: { name: 'Twinly', slug: 'twinly', massKg: 2 * SUN.massKg } })
		expect(m.satelliteOf?.slug).toBe('twinly')
		expect(m.system?.name).toBe('Twinly')
		// Twice the solar mass → year shortened by 1/√2.
		expect(m.orbitalPeriodDays).toBeCloseTo(365.25 / Math.SQRT2, 0)
	})

	it('falls back to the resolved moon count when no satellite count is stored', () => {
		expect(deriveBody(EARTH, { moonCount: 2 }).satellites).toBe(2)
		expect(deriveBody({ ...EARTH, satellites: 5 }, { moonCount: 2 }).satellites).toBe(5)
	})
})

describe('deriveStar', () => {
	it('derives luminosity + habitable zone from radius/temperature', () => {
		const m = deriveStar(SUN, { planetCount: 8, satelliteCount: 3 })
		expect(m.luminosityW! / 3.828e26).toBeCloseTo(1, 1)
		expect(m.habitableZoneAu!.inner).toBeLessThan(1)
		expect(m.habitableZoneAu!.outer).toBeGreaterThan(1)
	})

	it('derives a companion star period from the pair\'s combined mass', () => {
		const companion = { ...SUN, name: 'Sun B', slug: 'sun-b', semiMajorAxisAu: 1 }
		const m = deriveStar(companion, { parentStar: { name: 'Sun A', slug: 'sun-a', massKg: SUN.massKg } })
		// 2 M☉ total → 365.25/√2 days.
		expect(m.orbitalPeriodDays).toBeCloseTo(365.25 / Math.SQRT2, 0)
		expect(m.companionOf?.slug).toBe('sun-a')
	})

	it('derives a barycentric component period from the system stellar mass', () => {
		const component = { ...SUN, semiMajorAxisAu: 0.5 }
		const m = deriveStar(component, { barycenterMassKg: 2 * SUN.massKg })
		expect(m.orbitalPeriodDays).not.toBeNull()
	})

	it('carries companions through from the graph relation', () => {
		expect(deriveStar(SUN, { companions: [{ name: 'Therne', slug: 'therne' }] }).companions)
			.toEqual([{ name: 'Therne', slug: 'therne' }])
		// no relation → empty list
		expect(deriveStar(SUN, {}).companions).toEqual([])
	})
})
