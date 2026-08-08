import { describe, expect, it } from 'vitest'
import { composeSurfacePlan, describeSurfacePlan, parseSurfaceRecipe, surfaceMediaUrl } from './surface-model.js'

const body = { id: 7, slug: 'pelagos', bodyType: 'ocean world', composition: 'silicate and water' }

function temperatureFor(temperature: string): number | null {
	return composeSurfacePlan(
		{ ...body, temperature },
		{ class: 'terrestrial', hydrosphereFraction: 0.6 },
	).temperatureK
}

describe('surface composition plan', () => {
	it('uses a deterministic procedural fallback when no recipe exists', () => {
		const first = composeSurfacePlan(body, null)
		const second = composeSurfacePlan(body, null)
		expect(first.class).toBe('terrestrial')
		expect(first.seed).toBe(second.seed)
		expect(first.channels.albedo.source).toBe('procedural')
		expect(first.channels.clouds.source).toBe('unavailable')
		expect(first.vegetationFraction).toBe(0)
		expect(describeSurfacePlan(first)).toBe('Procedural terrestrial surface (illustrative)')
	})

	it('lets uploaded channels independently replace procedural channels', () => {
		const plan = composeSurfacePlan(body, {
			version: 1,
			maps: { albedo: 'Pelagos albedo.png', normal: 'Pelagos normal.png' },
		})
		expect(plan.channels.albedo).toMatchObject({ source: 'uploaded', filename: 'Pelagos albedo.png' })
		expect(plan.channels.normal).toMatchObject({ source: 'uploaded', filename: 'Pelagos normal.png' })
		expect(plan.channels.roughness.source).toBe('procedural')
		expect(describeSurfacePlan(plan)).toBe('Uploaded surface data (2 channels) with procedural gaps')
	})

	it('allows procedural generation to be disabled without requiring uploads', () => {
		const plan = composeSurfacePlan(body, { fallback: 'flat', class: 'rocky' })
		expect(plan.classSource).toBe('explicit')
		expect(plan.channels.albedo.source).toBe('constant')
		expect(plan.channels.elevation.source).toBe('unavailable')
		expect(plan.channels.roughness.source).toBe('constant')
	})

	it('sanitizes untrusted recipe values and encodes media filenames', () => {
		const recipe = parseSurfaceRecipe({
			fallback: 'nonsense', class: 'gas', seed: 4.9,
			hydrosphereFraction: 8, cloudCoverage: -2, vegetationFraction: 2, snowCoverage: -1,
			maps: { albedo: ' map one.png ', normal: 4 },
		})
		expect(recipe).toMatchObject({
			fallback: 'procedural', class: 'gas', seed: 4,
			hydrosphereFraction: 1, cloudCoverage: 0, vegetationFraction: 1, snowCoverage: 0,
			maps: { albedo: { filename: 'map one.png' } },
		})
		expect(surfaceMediaUrl('map one.png')).toBe('/api/media/map%20one.png')
	})

	it('requires evidence or an explicit fraction before generating vegetation', () => {
		const uninhabited = composeSurfacePlan(
			{ ...body, bodyType: 'terrestrial planet' },
			{ class: 'terrestrial', hydrosphereFraction: 0.71 },
		)
		const earthlike = composeSurfacePlan(
			{ ...body, bodyType: 'earth-like garden world', temperature: '15 °C' },
			{ class: 'terrestrial', hydrosphereFraction: 0.71 },
		)
		expect(uninhabited.vegetationFraction).toBe(0)
		expect(uninhabited.vegetationSource).toBe('default')
		expect(earthlike.vegetationFraction).toBe(0.55)
		expect(earthlike.vegetationSource).toBe('inferred')
		expect(earthlike.temperatureK).toBeCloseTo(288.15)
		expect(earthlike.snowCoverage).toBeGreaterThan(0)
		expect(earthlike.snowSource).toBe('inferred')
	})

	it('lets explicit zero disable temperature-guided snow', () => {
		const plan = composeSurfacePlan(
			{ ...body, temperature: '260 K' },
			{ class: 'terrestrial', hydrosphereFraction: 0.6, snowCoverage: 0 },
		)
		expect(plan.snowCoverage).toBe(0)
		expect(plan.snowSource).toBe('explicit')
	})

	it('understands authored Kelvin, Celsius, Fahrenheit, and typographic negative temperatures', () => {
		expect(temperatureFor('288 K (mean)')).toBe(288)
		expect(temperatureFor('15 °C')).toBeCloseTo(288.15)
		expect(temperatureFor('59 °F')).toBeCloseTo(288.15)
		expect(temperatureFor('−10 °C')).toBeCloseTo(263.15)
	})
})
