import { describe, it, expect } from 'vitest'
import { mergeSectorPosition } from './public/sector-position.js'

describe('mergeSectorPosition', () => {
	it('is unchanged when no sector field is present in the patch', () => {
		expect(mergeSectorPosition({ x: 1, y: 2, z: 3 }, {})).toEqual({ kind: 'unchanged' })
		expect(mergeSectorPosition(null, {})).toEqual({ kind: 'unchanged' })
	})

	it('sets a complete triple', () => {
		expect(mergeSectorPosition(null, { sectorX: 3.2, sectorY: -0.4, sectorZ: 1.1 }))
			.toEqual({ kind: 'set', x: 3.2, y: -0.4, z: 1.1 })
	})

	it('treats zero as a real coordinate, not an absence', () => {
		expect(mergeSectorPosition(null, { sectorX: 0, sectorY: 0, sectorZ: 0 }))
			.toEqual({ kind: 'set', x: 0, y: 0, z: 0 })
	})

	it('merges a single-axis patch over the stored position', () => {
		expect(mergeSectorPosition({ x: 1, y: 2, z: 3 }, { sectorY: 9 }))
			.toEqual({ kind: 'set', x: 1, y: 9, z: 3 })
	})

	it('clears when all three end up null', () => {
		expect(mergeSectorPosition({ x: 1, y: 2, z: 3 }, { sectorX: null, sectorY: null, sectorZ: null }))
			.toEqual({ kind: 'clear' })
		expect(mergeSectorPosition(null, { sectorX: null })).toEqual({ kind: 'clear' })
	})

	it('rejects a merge that leaves the triple partial', () => {
		expect(mergeSectorPosition(null, { sectorX: 5 }).kind).toBe('invalid')
		expect(mergeSectorPosition({ x: 1, y: 2, z: 3 }, { sectorZ: null }).kind).toBe('invalid')
		// A legacy partial triple stays readable, but a write touching it must complete it.
		expect(mergeSectorPosition({ x: 1, y: null, z: null }, { sectorX: 2 }).kind).toBe('invalid')
	})

	it('completing a legacy partial triple is allowed', () => {
		expect(mergeSectorPosition({ x: 1, y: null, z: null }, { sectorY: 2, sectorZ: 3 }))
			.toEqual({ kind: 'set', x: 1, y: 2, z: 3 })
	})
})
