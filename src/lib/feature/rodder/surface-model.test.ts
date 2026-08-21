import { describe, expect, it } from 'vitest'
import {
	composeSurfacePlan,
	describeSurfacePlan,
	parseSurfaceRecipe,
	surfaceMediaUrl,
	summarizeSurfacePlan,
} from './public/surface-model.js'

const body = { id: 7, slug: 'pelagos', bodyType: 'earth-like ocean garden world' }

describe('surface composition plan v5', () => {
	it('uses a deterministic rocky fallback without reading prose', () => {
		const first = composeSurfacePlan(body, null)
		const second = composeSurfacePlan({ ...body, bodyType: 'gas giant with forests' }, null)
		expect(first.class).toBe('rocky')
		expect(first.classSource).toBe('default')
		expect(first.seed).toBe(second.seed)
		expect(first.coverage).toEqual({ surfaceWater: null, vegetation: null, permanentSnowIce: null })
		expect(first.channels.albedo.source).toBe('procedural')
		expect(summarizeSurfacePlan(first)).toBe('Illustrative')
		expect(describeSurfacePlan(first)).toBe('Illustrative procedural rocky surface')
	})

	it('generates a normal channel with elevation, but never for gas', () => {
		const rocky = composeSurfacePlan(body, null)
		const gas = composeSurfacePlan(body, { class: 'gas' })
		expect(rocky.channels.normal.source).toBe('procedural')
		expect(gas.channels.normal.source).toBe('unavailable')
		expect(gas.channels.elevation.source).toBe('unavailable')
	})

	it('upgrades only explicit v3 values and removes auto class behavior', () => {
		const recipe = parseSurfaceRecipe({
			version: 3,
			class: 'auto',
			hydrosphereFraction: 0.71,
			vegetationFraction: 0,
			cloudCoverage: null,
			snowCoverage: 0.14,
		})
		expect(recipe).toMatchObject({
			version: 5,
			class: null,
			coverage: { surfaceWater: 0.71, vegetation: 0, permanentSnowIce: 0.14 },
		})
	})

	it('distinguishes unknown coverage from explicit zero', () => {
		const unknown = composeSurfacePlan(body, { class: 'terrestrial' })
		const zero = composeSurfacePlan(body, {
			class: 'terrestrial', coverage: { vegetation: 0 },
		})
		expect(unknown.coverage.vegetation).toBeNull()
		expect(unknown.coverageSource.vegetation).toBe('unknown')
		expect(zero.coverage.vegetation).toBe(0)
		expect(zero.coverageSource.vegetation).toBe('explicit')
	})

	it('lets uploaded channels independently replace procedural channels', () => {
		const plan = composeSurfacePlan(body, {
			maps: { albedo: 'Pelagos albedo.png', normal: 'Pelagos normal.png' },
		})
		expect(plan.channels.albedo).toMatchObject({ source: 'uploaded', filename: 'Pelagos albedo.png' })
		expect(plan.channels.normal).toMatchObject({ source: 'uploaded', filename: 'Pelagos normal.png' })
		expect(plan.channels.roughness.source).toBe('procedural')
		expect(summarizeSurfacePlan(plan)).toBe('Mixed')
	})

	it('sanitizes values and reports profile limits without overriding targets', () => {
		const plan = composeSurfacePlan(
			{ ...body, temperatureK: 500 },
			{
				class: 'terrestrial', seed: 4.9,
				coverage: { surfaceWater: 8, vegetation: 0.6, permanentSnowIce: -1, clouds: 2 },
				maps: { albedo: ' map one.png ', normal: 4, clouds: 'dated-clouds.png' },
			},
		)
		expect(plan.recipe).toMatchObject({
			class: 'terrestrial', seed: 4,
			coverage: { surfaceWater: 1, vegetation: 0.6, permanentSnowIce: 0 },
			maps: { albedo: { filename: 'map one.png' } },
		})
		expect(plan.coverage.vegetation).toBe(0.6)
		expect(plan.diagnostics.map(item => item.code)).toContain('profile-vegetation-temperature')
		expect(surfaceMediaUrl('map one.png')).toBe('/api/media/map%20one.png')
	})

	it('keeps prose independent from structured surface controls', () => {
		const recipe = { class: 'terrestrial', coverage: { surfaceWater: null, vegetation: null, permanentSnowIce: null } }
		const plain = composeSurfacePlan({ ...body, bodyType: 'planet' }, recipe)
		const suggestive = composeSurfacePlan({ ...body, bodyType: 'garden ocean biosphere forest' }, recipe)
		expect(suggestive.coverage).toEqual(plain.coverage)
		expect(suggestive.class).toBe(plain.class)
	})
})
