import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
	DEFAULT_STARLIGHT_EXPOSURE,
	MAX_STARLIGHT_EXPOSURE,
	SOLAR_IRRADIANCE_DISPLAY,
	StarlightController,
	formatStarlightExposure,
	focusedStarlightExposure,
	focusedStarlightTarget,
	resolveStarlightExposure,
	starlightFillIntensity,
	starlightPointIntensity,
} from './starlight-controller.js'

describe('starlight controller', () => {
	it('keeps illumination invariant when AU-to-world scaling changes', () => {
		for (const worldUnitsPerAu of [0.01, 1, 100, 8_000]) {
			const distanceWorld = worldUnitsPerAu * 2
			const irradiance = starlightPointIntensity(1, worldUnitsPerAu) / distanceWorld ** 2
			expect(irradiance).toBeCloseTo(SOLAR_IRRADIANCE_DISPLAY / 4, 10)
		}
	})

	it('keeps relative stellar output linear within the display bounds', () => {
		expect(starlightPointIntensity(2, 10)).toBeCloseTo(starlightPointIntensity(1, 10) * 2)
	})

	it('removes non-physical fill in Physical mode', () => {
		expect(starlightFillIntensity('physical')).toBe(0)
		expect(starlightFillIntensity('enhanced')).toBeGreaterThan(0)
		expect(starlightFillIntensity('markers')).toBeGreaterThan(starlightFillIntensity('enhanced'))
		const controller = new StarlightController()
		controller.setVisibilityMode('enhanced')
		controller.compensateFillForExposure(10)
		expect(controller.fillLight.intensity).toBeCloseTo(starlightFillIntensity('enhanced') / 10)
		controller.dispose()
	})

	it('uses bounded camera exposure for focused bodies without changing their light', () => {
		expect(focusedStarlightExposure(SOLAR_IRRADIANCE_DISPLAY)).toBe(DEFAULT_STARLIGHT_EXPOSURE)
		expect(focusedStarlightExposure(SOLAR_IRRADIANCE_DISPLAY / 25)).toBeCloseTo(DEFAULT_STARLIGHT_EXPOSURE * 25)
		expect(focusedStarlightExposure(1e-20)).toBe(MAX_STARLIGHT_EXPOSURE)
		expect(focusedStarlightExposure(0)).toBe(DEFAULT_STARLIGHT_EXPOSURE)
	})

	it('keeps Physical fixed while assisted modes publish explicit automatic EV', () => {
		const irradiance = SOLAR_IRRADIANCE_DISPLAY / 16
		const physical = resolveStarlightExposure('physical', irradiance)
		const enhanced = resolveStarlightExposure('enhanced', irradiance)
		expect(physical.policy).toBe('fixed')
		expect(physical.exposure).toBe(DEFAULT_STARLIGHT_EXPOSURE)
		expect(physical.ev).toBe(0)
		expect(formatStarlightExposure(physical, null)).toBe('Fixed exposure · 0.0 EV')
		expect(enhanced.policy).toBe('auto')
		expect(enhanced.ev).toBeCloseTo(4)
		expect(formatStarlightExposure(enhanced, 'Saxnat')).toBe('Auto exposure · +4.0 EV · Saxnat')
	})

	it('chooses exposure from the viewed body without requiring selection', () => {
		const candidates = [
			{ key: 'star:1' as const, isStar: true, inside: true, x: 400, y: 300, physicalRadiusPx: 30 },
			{ key: 'body:8' as const, isStar: false, inside: true, x: 415, y: 305, physicalRadiusPx: 22 },
		]
		expect(focusedStarlightTarget(candidates, 800, 600, 12)).toBe('body:8')
		expect(focusedStarlightTarget(candidates, 800, 600, 1)).toBeNull()
		expect(focusedStarlightTarget([
			{ key: 'body:9', isStar: false, inside: true, x: 400, y: 300, physicalRadiusPx: 0.5 },
		], 800, 600, 12)).toBeNull()
	})

	it('creates independent moving lights and reports fallback provenance', () => {
		const controller = new StarlightController()
		const summary = controller.rebuild([
			{ id: 1, name: 'Known', slug: 'known', bodyType: 'star', luminosityW: 3.828e26 },
			{ id: 2, name: 'Unknown', slug: 'unknown', bodyType: 'star' },
		], 100)
		expect(summary.lightCount).toBe(2)
		expect(summary.fallbackCount).toBe(1)
		expect(summary.label).toContain('fallback')

		controller.setPosition('star:1', new Vector3(4, 5, 6))
		const known = controller.group.getObjectByName('starlight:1')
		expect(known?.position.toArray()).toEqual([4, 5, 6])
		expect(controller.irradianceAt(new Vector3(4, 5, 16))).toBeGreaterThan(0)
		controller.dispose()
		expect(controller.group.children).toHaveLength(0)
	})
})
