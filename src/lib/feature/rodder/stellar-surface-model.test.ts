import { describe, expect, it } from 'vitest'
import {
	composeStellarSurfacePlan,
	describeStellarSurfacePlan,
	inferStellarMorphology,
	parseStellarSurfaceRecipe,
	representativeHostStar,
	resolveHostStarTemperatureK,
} from './public/stellar-surface-model.js'

describe('stellar surface recipe', () => {
	it('validates untrusted values and preserves a photosphere upload', () => {
		expect(parseStellarSurfaceRecipe({
			version: 99,
			fallback: 'wrong',
			morphology: 'giant',
			seed: 8.9,
			activity: 4,
			maps: { photosphere: ' Giant plate.png ', ignored: 'x.png' },
		})).toEqual({
			version: 2,
			fallback: 'procedural',
			morphology: 'giant',
			seed: 8,
			activity: 1,
			maps: { photosphere: {
				version: 1, mediaId: null, filename: 'Giant plate.png', contentHash: null,
				interpretation: { projection: 'equirectangular', colorSpace: 'srgb' },
			} },
		})
	})

	it('infers only morphology supported by the generator', () => {
		expect(inferStellarMorphology('G2V')).toBe('main_sequence')
		expect(inferStellarMorphology('K2III')).toBe('giant')
		expect(inferStellarMorphology('DA2')).toBe('white_dwarf')
		expect(inferStellarMorphology('G4IV')).toBe('main_sequence')
	})

	it('composes deterministic defaults without claiming stored measurements', () => {
		const body = { id: 7, slug: 'sun', spectralType: 'G2V' }
		const first = composeStellarSurfacePlan(body, null)
		const second = composeStellarSurfacePlan(body, null)
		expect(first.seed).toBe(second.seed)
		expect(first.temperatureK).toBe(5_600)
		expect(first.temperatureSource).toBe('spectral')
		expect(first.rotationSource).toBe('default')
		expect(first.photosphere.source).toBe('procedural')
		expect(describeStellarSurfacePlan(first).toLowerCase()).toContain('illustrative')
	})

	it('lets an upload supersede generation while retaining its fallback recipe', () => {
		const plan = composeStellarSurfacePlan(
			{ id: 8, slug: 'sirius-b', spectralType: 'DA2', temperatureK: 25_000, rotationPeriodS: 300 },
			{ maps: { photosphere: 'Sirius B.png' }, fallback: 'procedural', activity: 0.8 },
		)
		expect(plan.morphology).toBe('white_dwarf')
		expect(plan.temperatureSource).toBe('stored')
		expect(plan.rotationDays).toBeCloseTo(300 / 86_400)
		expect(plan.activity).toBe(0.8)
		expect(plan.photosphere).toMatchObject({ source: 'uploaded', filename: 'Sirius B.png' })
	})

	it('resolves explicit and system-parented hosts with one deterministic convention', () => {
		const stars = [
			{ id: 10, systemId: 4, massKg: 8e29, temperatureK: 3_200 },
			{ id: 11, systemId: 4, massKg: 2e30, temperatureK: 6_200 },
			{ id: 12, systemId: 5, massKg: 3e30, temperatureK: 8_500 },
		]
		expect(representativeHostStar(stars, { starId: '10', systemId: '4' })?.id).toBe(10)
		expect(representativeHostStar(stars, { systemId: '4' })?.id).toBe(11)
		expect(resolveHostStarTemperatureK(stars, { systemId: 4 })).toBe(6_200)
	})

	it('recognizes renderer parent-system references and breaks equal-mass ties by id', () => {
		const stars = [
			{ id: 22, parentSystemId: 9, massKg: 1e30, spectralType: 'K2V' },
			{ id: 21, parentSystemId: 9, massKg: 1e30, spectralType: 'M3V' },
		]
		expect(representativeHostStar(stars, { systemId: 9 })?.id).toBe(21)
		expect(resolveHostStarTemperatureK(stars, { systemId: 9 })).toBe(3_200)
	})
})
