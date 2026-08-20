import { describe, it, expect } from 'vitest'
import {
	formatSectorPosition,
	positionedRoots,
	sectorBoundsRadius,
	sectorDistance,
	sectorGridSpacing,
	unpositionedRoots,
	type SectorRootView,
} from './sector-view.js'

function root(overrides: Partial<SectorRootView>): SectorRootView {
	return {
		rootId: 1, bodyId: 1, name: 'Helion', slug: 'helion', kind: 'system',
		x: null, y: null, z: null,
		positionProvenance: 'authored', positionUncertainty: null,
		distanceLy: null, starCount: 1, planetCount: 0,
		...overrides,
	}
}

describe('positioned/unpositioned partition', () => {
	it('requires a complete triple — partial legacy positions are unavailable', () => {
		const roots = [
			root({ rootId: 1, x: 0, y: 0, z: 0 }),
			root({ rootId: 2, x: 3.2, y: null, z: 1.1 }),
			root({ rootId: 3 }),
		]
		expect(positionedRoots(roots).map(r => r.rootId)).toEqual([1])
		expect(unpositionedRoots(roots).map(r => r.rootId)).toEqual([2, 3])
	})

	it('treats the origin as a real position', () => {
		expect(positionedRoots([root({ x: 0, y: 0, z: 0 })])).toHaveLength(1)
	})
})

describe('sectorBoundsRadius', () => {
	it('is the farthest positioned root from the origin', () => {
		const roots = [
			root({ x: 0, y: 0, z: 0 }),
			root({ x: 3, y: 4, z: 0 }), // 5 from origin
		]
		expect(sectorBoundsRadius(roots)).toBe(5)
	})

	it('floors at the minimum for empty or origin-only sectors', () => {
		expect(sectorBoundsRadius([])).toBe(1)
		expect(sectorBoundsRadius([root({ x: 0, y: 0, z: 0 })])).toBe(1)
	})
})

describe('sectorDistance', () => {
	it('is euclidean in sector units', () => {
		const a = root({ x: 0, y: 0, z: 0 })
		const b = root({ x: 3, y: 4, z: 12 })
		expect(sectorDistance(a as never, b as never)).toBe(13)
	})
})

describe('formatSectorPosition', () => {
	it('formats a complete triple with units and returns null otherwise', () => {
		expect(formatSectorPosition(root({ x: 3.2, y: -0.4, z: 1.125 }), 'ly')).toBe('(3.2, -0.4, 1.13) ly')
		expect(formatSectorPosition(root({ x: 3.2 }), 'ly')).toBeNull()
	})
})

describe('sectorGridSpacing', () => {
	it('snaps to a 1/2/5 decade near a quarter of the bounds', () => {
		expect(sectorGridSpacing(4)).toBe(1)
		expect(sectorGridSpacing(10)).toBe(5)
		expect(sectorGridSpacing(12)).toBe(5)
		expect(sectorGridSpacing(40)).toBe(10)
		expect(sectorGridSpacing(100)).toBe(50)
	})

	it('stays positive for tiny sectors', () => {
		expect(sectorGridSpacing(0.5)).toBeGreaterThan(0)
	})
})
