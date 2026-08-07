import { describe, expect, it } from 'vitest'
import {
	ASTRONOMICAL_UNIT_M,
	EARTH_RADIUS_M,
	SOLAR_RADIUS_M,
	overviewBodyExtent,
	overviewBodyRadius,
	physicalBodyExtent,
	physicalBodyRadius,
} from './body-sizing.js'

describe('overview body sizing', () => {
	it('compresses physical radii without erasing their ordering', () => {
		const earth = overviewBodyRadius({ radiusM: EARTH_RADIUS_M }, false, false)
		const jupiter = overviewBodyRadius({ radiusM: EARTH_RADIUS_M * 11.2 }, false, false)
		const sun = overviewBodyRadius({ radiusM: SOLAR_RADIUS_M }, true, false)
		expect(jupiter).toBeGreaterThan(earth)
		expect(jupiter).toBeLessThan(earth * 2)
		expect(sun).toBe(7)
	})

	it('includes rings in collision clearance without inflating the planet mesh', () => {
		const body = { radiusM: EARTH_RADIUS_M, hasRings: true }
		expect(overviewBodyExtent(body, false, false)).toBeCloseTo(
			overviewBodyRadius(body, false, false) * 1.9,
		)
	})

	it('converts physical radii with the same AU scale as orbital vectors', () => {
		const worldUnitsPerAu = 320
		const earth = { radiusM: EARTH_RADIUS_M }
		expect(physicalBodyRadius(earth, false, false, worldUnitsPerAu)).toBeCloseTo(
			EARTH_RADIUS_M / ASTRONOMICAL_UNIT_M * worldUnitsPerAu,
		)
		expect(physicalBodyExtent({ ...earth, hasRings: true }, false, false, worldUnitsPerAu)).toBeCloseTo(
			physicalBodyRadius(earth, false, false, worldUnitsPerAu) * 1.9,
		)
	})
})
