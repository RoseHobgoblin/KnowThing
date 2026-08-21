import { describe, it, expect } from 'vitest'
import { deriveBody, deriveStar } from 'tungolcraft'
import type { RodderEntityDocument } from './public/consumer-contract.js'
import { bodyInfoboxFields, rodderDocumentInfoboxFields, starInfoboxFields, rodderStatTiles } from './public/projections.js'

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

describe('retired body fields', () => {
	it('does not resurrect free-text albedo from extra data', () => {
		const model = deriveBody({ ...EARTH, extra: { albedo: '0.306-ish' } }, {})
		expect(bodyInfoboxFields(model).has('albedo')).toBe(false)
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

describe('rodderStatTiles projection', () => {
	it('emits reference-scaled tiles from raw SI numbers', () => {
		const planet = rodderStatTiles(deriveBody(EARTH, {}))
		const radius = planet.find(t => t.label === 'Radius')
		expect(radius?.sub).toMatch(/Earth/)

		const star = rodderStatTiles(deriveStar(SUN, {}))
		expect(star.find(t => t.label === 'Luminosity')?.sub).toMatch(/Sun/)
	})
})

describe('rodderDocumentInfoboxFields projection', () => {
	it('projects a system infobox entirely from the public document', () => {
		const document = {
			identity: { kind: 'system', name: 'Example Root' },
			authored: {
				description: 'A documented system.',
				system: { distanceLy: 12.5, formationAge: '4 Ga', designations: 'EX-1' },
				extensions: { catalogue: 'Survey A', nested: { internal: false } },
			},
			placement: {
				sector: { units: 'ly', name: 'Example Sector' },
				position: { x: 1, y: 2, z: 3 },
			},
			resolved: { facts: { systemType: { value: 'binary' } } },
			displays: {
				rootMap: {
					stars: [
						{ name: 'Primary', slug: 'primary', spectralType: 'G2V' },
						{ name: 'Companion', slug: 'companion', spectralType: 'M3V' },
					],
					bodies: [
						{ parentId: null },
						{ parentId: 10 },
					],
				},
			},
		} as unknown as RodderEntityDocument

		const fields = rodderDocumentInfoboxFields(document)
		expect(fields?.get('system_type')).toBe('binary')
		expect(fields?.get('stars')).toContain('[[primary|Primary]] (G2V)')
		expect(fields?.get('planets')).toBe('1')
		expect(fields?.get('satellites')).toBe('1')
		expect(fields?.get('coordinates')).toBe('(1, 2, 3) ly, Example Sector frame')
		expect(fields?.get('catalogue')).toBe('Survey A')
		expect(fields?.has('nested')).toBe(false)
	})

	it('keeps authored metadata useful when a body model is unavailable', () => {
		const document = {
			identity: { kind: 'body', name: 'Sparse Body' },
			authored: {
				description: 'Known from a partial catalogue.',
				extensions: { catalogue: 'Survey B', nested: { hidden: true } },
			},
			resolved: { facts: { model: { value: null, status: 'unavailable' } } },
		} as unknown as RodderEntityDocument

		const fields = rodderDocumentInfoboxFields(document)
		expect(fields?.get('name')).toBe('Sparse Body')
		expect(fields?.get('description')).toBe('Known from a partial catalogue.')
		expect(fields?.get('catalogue')).toBe('Survey B')
		expect(fields?.has('nested')).toBe(false)
	})
})
