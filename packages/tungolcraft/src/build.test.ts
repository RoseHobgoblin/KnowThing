import { describe, it, expect } from 'vitest'
import { body, star } from './build.js'
import { solarMasses, solarRadii, earthMasses, earthRadii, au, kelvin } from './units.js'

describe('star (human-unit builder)', () => {
	it('accepts reference units and derives luminosity + habitable zone', () => {
		const m = star({ name: 'Sol', mass: solarMasses(1), radius: solarRadii(1), temperature: kelvin(5778) })
		expect(m.luminosityW! / 3.828e26).toBeCloseTo(1, 1)
		expect(m.habitableZoneAu!.inner).toBeLessThan(1)
		expect(m.habitableZoneAu!.outer).toBeGreaterThan(1)
	})

	it('defaults the slug from the name', () => {
		expect(star({ name: 'Alpha Centauri A' }).slug).toBe('alpha-centauri-a')
		expect(star({ name: 'Sol', slug: 'the-sun' }).slug).toBe('the-sun')
	})

	it('produces the same model as deriveStar given equivalent SI input', () => {
		const m = star({ name: 'Sol', slug: 'sol', mass: solarMasses(1), radius: solarRadii(1), temperature: kelvin(5778) })
		expect(m.massKg).toBeCloseTo(1.989e30, -28)
		expect(m.radiusM).toBeCloseTo(6.9634e8, -6)
	})
})

describe('body (human-unit builder)', () => {
	it('derives orbital period from a parent star mass', () => {
		const m = body(
			{ name: 'Earth', mass: earthMasses(1), radius: earthRadii(1), semiMajorAxis: au(1), eccentricity: 0.0167 },
			{ star: { name: 'Sol', slug: 'sol', massKg: solarMasses(1) } },
		)
		expect(m.orbitalPeriodDays).toBeCloseTo(365, 0)
		expect(m.gravityMs2).toBeCloseTo(9.8, 1)
		expect(m.satelliteOf?.slug).toBe('sol')
	})

	it('converts reference masses/radii to SI', () => {
		const m = body({ name: 'Earth', mass: earthMasses(1), radius: earthRadii(1) })
		expect(m.massKg).toBeCloseTo(5.972e24, -22)
		expect(m.radiusM).toBeCloseTo(6.371e6, -4)
	})
})
