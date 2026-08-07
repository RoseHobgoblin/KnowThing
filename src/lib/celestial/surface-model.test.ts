import { describe, expect, it } from 'vitest'
import { composeSurfacePlan, describeSurfacePlan, parseSurfaceRecipe, surfaceMediaUrl } from './surface-model.js'

const body = { id: 7, slug: 'pelagos', bodyType: 'ocean world', composition: 'silicate and water' }

describe('surface composition plan', () => {
	it('uses a deterministic procedural fallback when no recipe exists', () => {
		const first = composeSurfacePlan(body, null)
		const second = composeSurfacePlan(body, null)
		expect(first.class).toBe('terrestrial')
		expect(first.seed).toBe(second.seed)
		expect(first.channels.albedo.source).toBe('procedural')
		expect(first.channels.clouds.source).toBe('unavailable')
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
			hydrosphereFraction: 8, cloudCoverage: -2,
			maps: { albedo: ' map one.png ', normal: 4 },
		})
		expect(recipe).toMatchObject({
			fallback: 'procedural', class: 'gas', seed: 4,
			hydrosphereFraction: 1, cloudCoverage: 0,
			maps: { albedo: { filename: 'map one.png' } },
		})
		expect(surfaceMediaUrl('map one.png')).toBe('/api/media/map%20one.png')
	})
})
