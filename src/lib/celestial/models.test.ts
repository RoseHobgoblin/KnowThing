import { describe, it, expect } from 'vitest'
import { deriveBody, deriveStar } from './models.js'
import { bodyInfoboxFields, starInfoboxFields, celestialStatTiles } from './projections.js'

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
})

describe('bodyInfoboxFields projection', () => {
	it('produces the snake_case keys the infobox reads, formatted', () => {
		const m = deriveBody(EARTH, { star: { name: 'Sun', slug: 'the-sun', massKg: SUN.massKg } })
		const f = bodyInfoboxFields(m)
		expect(f.get('mass')).toMatch(/M⊕|kg/)
		expect(f.get('surface_gravity')).toMatch(/m\/s²/)
		expect(f.get('escape_velocity')).toMatch(/km\/s/)
		expect(f.get('orbital_period')).toBeTruthy()
		expect(f.get('parent_star')).toBe('Sun')
		expect(f.get('satellite_of')).toBe('Sun')
	})

	it('lets an extra/override value win over the derived one', () => {
		const m = deriveBody({ ...EARTH, extra: { surface_gravity: '42 m/s²' } }, {})
		const f = bodyInfoboxFields(m)
		expect(f.get('surface_gravity')).toBe('42 m/s²')
	})
})

describe('deriveStar + projection', () => {
	it('derives luminosity + habitable zone from radius/temperature', () => {
		const m = deriveStar(SUN, { planetCount: 8, satelliteCount: 3 })
		expect(m.luminosityW! / 3.828e26).toBeCloseTo(1, 1)
		expect(m.habitableZoneAu!.inner).toBeLessThan(1)
		expect(m.habitableZoneAu!.outer).toBeGreaterThan(1)
	})

	it('projects to infobox fields including counts and HZ', () => {
		const m = deriveStar(SUN, { planetCount: 8, satelliteCount: 3 })
		const f = starInfoboxFields(m)
		expect(f.get('luminosity')).toBeTruthy()
		expect(f.get('habitable_zone')).toMatch(/AU/)
		expect(f.get('planets')).toBe('8')
		expect(f.get('known_satellites')).toBe('3')
	})
})

describe('celestialStatTiles projection', () => {
	it('emits reference-scaled tiles from raw SI numbers', () => {
		const planet = celestialStatTiles(deriveBody(EARTH, {}))
		const radius = planet.find(t => t.label === 'Radius')
		expect(radius?.sub).toMatch(/Earth/)

		const star = celestialStatTiles(deriveStar(SUN, {}))
		expect(star.find(t => t.label === 'Luminosity')?.sub).toMatch(/Sun/)
	})
})
