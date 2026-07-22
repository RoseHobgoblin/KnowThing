import { describe, it, expect } from 'vitest'
import { deriveBody, deriveStar } from 'tungolcraft'
import { bodyInfoboxFields, starInfoboxFields, celestialStatTiles } from './projections.js'

const EARTH = { name: 'Earth', slug: 'earth', massKg: 5.972e24, radiusM: 6.371e6, semiMajorAxisAu: 1, eccentricity: 0.0167, rotationPeriodS: 86_164 }
const SUN = { name: 'Sun', slug: 'the-sun', massKg: 1.989e30, radiusM: 6.9634e8, temperatureK: 5778 }

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
	it('companions come from the graph relation and project as linked entities', () => {
		const m = deriveStar(SUN, { companions: [{ name: 'Therne', slug: 'therne' }] })
		expect(m.companions).toEqual([{ name: 'Therne', slug: 'therne' }])
		expect(starInfoboxFields(m).get('companion')).toBe('[[therne|Therne]]')
		// no relation → empty list, no infobox row
		expect(deriveStar(SUN, {}).companions).toEqual([])
		expect(starInfoboxFields(deriveStar(SUN, {})).has('companion')).toBe(false)
	})

	it('an extra override still wins over the derived companions row', () => {
		const m = deriveStar({ ...SUN, extra: { companion: 'An unseen dark companion' } }, { companions: [{ name: 'Therne', slug: 'therne' }] })
		expect(starInfoboxFields(m).get('companion')).toBe('An unseen dark companion')
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
