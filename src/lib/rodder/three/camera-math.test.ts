import { describe, expect, it } from 'vitest'
import {
	constrainPointOutsideSphere,
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

	it('stops a dolly at the near surface instead of passing inside a body', () => {
		const camera = { x: 0, y: 0, z: 2 }
		const previousCamera = { x: 0, y: 0, z: 12 }
		const constrained = constrainPointOutsideSphere(camera, previousCamera, { x: 0, y: 0, z: 0 }, 5)

		expect(constrained).toBe(true)
		expect(camera).toEqual({ x: 0, y: 0, z: 5 })
	})

	it('does not move a camera that remains outside a body', () => {
		const camera = { x: 0, y: 0, z: 6 }
		const constrained = constrainPointOutsideSphere(camera, { x: 0, y: 0, z: 7 }, { x: 0, y: 0, z: 0 }, 5)

		expect(constrained).toBe(false)
		expect(camera.z).toBe(6)
	})

	it('blocks a large dolly step from crossing through to the far side', () => {
		const camera = { x: 0, y: 0, z: -8 }
		const constrained = constrainPointOutsideSphere(camera, { x: 0, y: 0, z: 12 }, { x: 0, y: 0, z: 0 }, 5)

		expect(constrained).toBe(true)
		expect(camera.z).toBeCloseTo(5)
	})
})
