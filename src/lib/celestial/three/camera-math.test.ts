import { describe, expect, it } from 'vitest'
import {
	orthographicZoomForWorldUnitsPerPixel,
	perspectiveDistanceForWorldUnitsPerPixel,
	perspectiveDistanceToFrameSphere,
	perspectiveWorldUnitsPerPixel,
} from './camera-math.js'

describe('celestial camera projection math', () => {
	it('round-trips perspective depth and pixel scale', () => {
		const scale = perspectiveWorldUnitsPerPixel(920, 720, 50)
		expect(perspectiveDistanceForWorldUnitsPerPixel(scale, 720, 50)).toBeCloseTo(920)
	})

	it('moves farther away to frame a sphere in a tall viewport', () => {
		const landscape = perspectiveDistanceToFrameSphere(370, 16 / 9, 50)
		const portrait = perspectiveDistanceToFrameSphere(370, 9 / 16, 50)
		expect(portrait).toBeGreaterThan(landscape)
	})

	it('matches an orthographic camera to a requested pixel scale', () => {
		expect(orthographicZoomForWorldUnitsPerPixel(800, 800, 0.5)).toBe(2)
	})
})
