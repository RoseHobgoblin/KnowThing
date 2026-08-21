import { describe, expect, it } from 'vitest'
import {
	SOLAR_LUMINOSITY_W,
	describeStarlightLuminosity,
	resolveStarlightLuminosity,
} from './public/starlight-model.js'

const star = {
	id: 1,
	name: 'Test star',
	slug: 'test-star',
	bodyType: 'star',
}

describe('starlight luminosity', () => {
	it('uses a finite positive stored luminosity first', () => {
		const resolved = resolveStarlightLuminosity({ ...star, luminosityW: SOLAR_LUMINOSITY_W * 2 })
		expect(resolved.source).toBe('stored')
		expect(resolved.solarLuminosities).toBe(2)
	})

	it('derives luminosity from radius and effective temperature', () => {
		const resolved = resolveStarlightLuminosity({
			...star,
			radiusM: 695_700_000,
			temperatureK: 5772,
		})
		expect(resolved.source).toBe('derived')
		expect(resolved.solarLuminosities).toBeCloseTo(1, 2)
	})

	it('uses and reports a deterministic display fallback when homework is absent', () => {
		const resolved = resolveStarlightLuminosity(star)
		expect(resolved.source).toBe('fallback')
		expect(resolved.solarLuminosities).toBe(1)
		expect(describeStarlightLuminosity(star)).toContain('display fallback')
	})

	it('rejects invalid stored or derived inputs', () => {
		const resolved = resolveStarlightLuminosity({
			...star,
			luminosityW: Number.POSITIVE_INFINITY,
			radiusM: -1,
			temperatureK: 0,
		})
		expect(resolved.source).toBe('fallback')
	})
})
