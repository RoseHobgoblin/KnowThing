import { describe, expect, it } from 'vitest'
import { resolveBodyVisibility } from './visibility-controller.js'

describe('body visibility controller', () => {
	it('keeps Physical literal with no screen-space marker or pick minimum', () => {
		const result = resolveBodyVisibility({
			mode: 'physical', kind: 'body', projectedRadiusPx: 0.2, previous: { markerActive: true },
		})
		expect(result.meshVisible).toBe(true)
		expect(result.markerOpacity).toBe(0)
		expect(result.pickRadiusPx).toBe(0.2)
		expect(result.screenExtentPx).toBe(0.2)
	})

	it('adds a subtle discoverability marker and pick target in Enhanced', () => {
		const result = resolveBodyVisibility({
			mode: 'enhanced', kind: 'satellite', projectedRadiusPx: 0.2, previous: { markerActive: false },
		})
		expect(result.meshVisible).toBe(true)
		expect(result.markerDiameterPx).toBe(6)
		expect(result.markerOpacity).toBeGreaterThan(0)
		expect(result.pickRadiusPx).toBe(8)
	})

	it('uses hysteresis after an Enhanced marker fades out', () => {
		const readable = resolveBodyVisibility({
			mode: 'enhanced', kind: 'body', projectedRadiusPx: 5.4, previous: { markerActive: true },
		})
		expect(readable.markerActive).toBe(false)
		expect(readable.markerOpacity).toBe(0)

		const settling = resolveBodyVisibility({
			mode: 'enhanced', kind: 'body', projectedRadiusPx: 4.9, previous: readable,
		})
		expect(settling.markerActive).toBe(false)
		expect(settling.markerOpacity).toBe(0)
	})

	it('uses prominent markers and omits only a subpixel mesh in Markers', () => {
		const tiny = resolveBodyVisibility({
			mode: 'markers', kind: 'body', projectedRadiusPx: 0.4, previous: { markerActive: false },
		})
		expect(tiny.meshVisible).toBe(false)
		expect(tiny.markerDiameterPx).toBe(13)
		expect(tiny.markerOpacity).toBe(1)

		const readable = resolveBodyVisibility({
			mode: 'markers', kind: 'body', projectedRadiusPx: 12, previous: tiny,
		})
		expect(readable.meshVisible).toBe(true)
		expect(readable.markerOpacity).toBe(0)
	})
})
