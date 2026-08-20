import { describe, expect, it } from 'vitest'
import {
	DASH_GAP_PX,
	DASH_SIZE_PX,
	ORBIT_LOCAL_REFINEMENT_LEVELS,
	ORBIT_SEGMENTS,
	closedOrbitAngles,
	screenDashScale,
} from './orbit-path-policy.js'

describe('orbit path policy', () => {
	it('includes the current body anomaly as an exact, locally refined path vertex', () => {
		const anchor = 0.123456789
		const angles = closedOrbitAngles(ORBIT_SEGMENTS, [anchor])
		expect(angles).toContain(anchor)
		expect(angles[0]).toBe(0)
		expect(angles.at(-1)).toBeCloseTo(Math.PI * 2)
		expect(angles.length).toBeLessThanOrEqual(ORBIT_SEGMENTS + ORBIT_LOCAL_REFINEMENT_LEVELS * 2 + 2)
		const anchorIndex = angles.indexOf(anchor)
		expect(anchor - angles[anchorIndex - 1]).toBeLessThan(2 * Math.PI / ORBIT_SEGMENTS / 500)
		expect(angles[anchorIndex + 1] - anchor).toBeLessThan(2 * Math.PI / ORBIT_SEGMENTS / 500)
		for (let index = 1; index < angles.length; index++) {
			expect(angles[index]).toBeGreaterThan(angles[index - 1])
		}
	})

	it('keeps dash and gap lengths constant in screen pixels', () => {
		for (const worldUnitsPerPixel of [2, 0.5, 0.001]) {
			const scale = screenDashScale(worldUnitsPerPixel)
			expect(DASH_SIZE_PX / scale / worldUnitsPerPixel).toBeCloseTo(DASH_SIZE_PX)
			expect(DASH_GAP_PX / scale / worldUnitsPerPixel).toBeCloseTo(DASH_GAP_PX)
		}
	})
})
