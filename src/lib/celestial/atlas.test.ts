import { describe, it, expect } from 'vitest'
import { enrichSystems, filterSystems, matchedBodyName, type AtlasSystem, type AtlasStar, type AtlasBody } from './atlas.js'

const systems: AtlasSystem[] = [
	{ id: 1, name: 'Sunly', slug: 'Sunly', systemType: null, starCount: 2, planetCount: 3 },
	{ id: 2, name: 'Vega', slug: 'Vega', systemType: null, starCount: 1, planetCount: 1 },
]
const stars: AtlasStar[] = [
	{ id: 10, name: 'Sun', slug: 'Sun', spectralType: 'G2V', color: 'yellow', systemId: 1 },
	{ id: 11, name: 'Therne', slug: 'Therne', spectralType: 'M3V', color: null, systemId: 1 },
	{ id: 12, name: 'Vega A', slug: 'Vega_A', spectralType: 'A0V', color: null, systemId: 2 },
]
const bodies: AtlasBody[] = [
	{ id: 20, name: 'Cael', slug: 'Cael', bodyType: 'planet', starId: 10, parentId: null },
	{ id: 21, name: 'Rustmere', slug: 'Rustmere', bodyType: 'planet', starId: 10, parentId: null },
	{ id: 22, name: 'Mirl', slug: 'Mirl', bodyType: 'planet', starId: 10, parentId: 20 },
	{ id: 30, name: 'Vega b', slug: 'Vega_b', bodyType: 'planet', starId: 12, parentId: null },
]

describe('enrichSystems', () => {
	const enriched = enrichSystems(systems, stars, bodies)

	it('derives system type from star count', () => {
		expect(enriched.find(e => e.system.id === 1)?.type).toBe('binary')
		expect(enriched.find(e => e.system.id === 2)?.type).toBe('single')
	})

	it('collects distinct spectral classes in temperature order', () => {
		expect(enriched.find(e => e.system.id === 1)?.classes).toEqual(['G', 'M'])
		expect(enriched.find(e => e.system.id === 2)?.classes).toEqual(['A'])
	})

	it('counts moons (bodies with a parent)', () => {
		expect(enriched.find(e => e.system.id === 1)?.moonCount).toBe(1)
		expect(enriched.find(e => e.system.id === 2)?.moonCount).toBe(0)
	})

	it('builds a haystack including star and body names', () => {
		const sunly = enriched.find(e => e.system.id === 1)
		expect(sunly?.haystack).toContain('rustmere')
		expect(sunly?.haystack).toContain('therne')
	})
})

describe('filterSystems', () => {
	const enriched = enrichSystems(systems, stars, bodies)
	const base = { query: '', types: [] as string[], classes: [] as string[], sort: 'name' as const }

	it('matches a system by a contained body name', () => {
		const out = filterSystems(enriched, { ...base, query: 'rustmere' })
		expect(out.map(e => e.system.name)).toEqual(['Sunly'])
	})

	it('filters by system type', () => {
		const out = filterSystems(enriched, { ...base, types: ['single'] })
		expect(out.map(e => e.system.name)).toEqual(['Vega'])
	})

	it('filters by spectral class', () => {
		const out = filterSystems(enriched, { ...base, classes: ['M'] })
		expect(out.map(e => e.system.name)).toEqual(['Sunly'])
	})

	it('sorts by most planets', () => {
		const out = filterSystems(enriched, { ...base, sort: 'planets' })
		expect(out.map(e => e.system.name)).toEqual(['Sunly', 'Vega'])
	})
})

describe('matchedBodyName', () => {
	const [sunly] = enrichSystems(systems, stars, bodies)

	it('returns the matching body when the system name did not match', () => {
		expect(matchedBodyName(sunly, 'rustmere')).toBe('Rustmere')
	})

	it('returns null when the system name itself matched', () => {
		expect(matchedBodyName(sunly, 'sunly')).toBeNull()
	})
})
