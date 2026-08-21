import { describe, expect, it } from 'vitest'
import {
	ASTRONOMICAL_UNIT_M,
	EARTH_RADIUS_M,
	SOLAR_RADIUS_M,
	overviewBodyExtent,
	overviewBodyRadius,
	physicalBodyExtent,
	physicalBodyRadius,
} from './public/body-sizing.js'

describe('overview body sizing', () => {
	it('compresses physical radii without erasing their ordering', () => {
		const earth = overviewBodyRadius({ radiusM: EARTH_RADIUS_M }, false, false)
		const jupiter = overviewBodyRadius({ radiusM: EARTH_RADIUS_M * 11.2 }, false, false)
		const sun = overviewBodyRadius({ radiusM: SOLAR_RADIUS_M }, true, false)
		expect(jupiter).toBeGreaterThan(earth)
		expect(jupiter).toBeLessThan(earth * 2)
		expect(sun).toBe(7)
	})

	it('converts physical radii with the same AU scale as orbital vectors', () => {
		const worldUnitsPerAu = 320
		const earth = { radiusM: EARTH_RADIUS_M }
		expect(physicalBodyRadius(earth, false, false, worldUnitsPerAu)).toBeCloseTo(
			EARTH_RADIUS_M / ASTRONOMICAL_UNIT_M * worldUnitsPerAu,
		)
		expect(physicalBodyExtent(earth, false, false, worldUnitsPerAu)).toBeCloseTo(
			physicalBodyRadius(earth, false, false, worldUnitsPerAu),
		)
	})

	it('uses authored outer band radii and leaves an empty system at the body radius', () => {
		const worldUnitsPerAu = 100
		const authored = {
			radiusM: 10_000_000,
			ringSystems: [{
				id: 2, name: 'Rings', slug: 'rings',
				ringSystem: {
					schemaVersion: 1 as const,
					plane: 'parent-equatorial' as const,
					bands: [
						{ innerRadiusM: 13_000_000, outerRadiusM: 16_000_000, provenance: 'authored' as const },
						{ innerRadiusM: 18_000_000, outerRadiusM: 22_000_000, provenance: 'authored' as const },
					],
				},
			}],
		}
		expect(physicalBodyExtent(authored, false, false, worldUnitsPerAu)).toBeCloseTo(
			22_000_000 / ASTRONOMICAL_UNIT_M * worldUnitsPerAu,
		)
		expect(overviewBodyExtent(authored, false, false)).toBeCloseTo(
			overviewBodyRadius(authored, false, false) * 2.2,
		)

		const explicitEmpty = {
			radiusM: EARTH_RADIUS_M,
			ringSystems: [{
				id: 3, name: 'Empty', slug: 'empty',
				ringSystem: { schemaVersion: 1 as const, plane: 'parent-equatorial' as const, bands: [] },
			}],
		}
		expect(physicalBodyExtent(explicitEmpty, false, false, worldUnitsPerAu)).toBeCloseTo(
			physicalBodyRadius(explicitEmpty, false, false, worldUnitsPerAu),
		)
	})
})
