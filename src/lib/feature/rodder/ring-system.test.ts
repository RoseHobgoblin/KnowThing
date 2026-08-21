import { describe, expect, it } from 'vitest'
import {
	parseRingSystem,
	ringSystemSchema,
	summarizeRingSystem,
} from './public/ring-system.js'

const bands = [
	{ name: 'Broad band', innerRadiusM: 70_000_000, outerRadiusM: 90_000_000, opacity: 0.28, provenance: 'authored' as const },
	{ name: 'Narrow band', innerRadiusM: 96_000_000, outerRadiusM: 99_000_000, opacity: 0.52, provenance: 'imported' as const },
]

describe('ring system contract', () => {
	it('accepts ordered bands and derives its radial summary', () => {
		const system = ringSystemSchema.parse({
			schemaVersion: 1,
			plane: 'parent-equatorial',
			origin: 'tidal-disruption',
			bands,
		})
		expect(summarizeRingSystem(system)).toEqual({
			bandCount: 2,
			innerRadiusM: 70_000_000,
			outerRadiusM: 99_000_000,
			widthM: 29_000_000,
		})
	})

	it('rejects inverted, overlapping, and out-of-order extents', () => {
		expect(ringSystemSchema.safeParse({
			schemaVersion: 1, plane: 'parent-equatorial',
			bands: [{ innerRadiusM: 20, outerRadiusM: 10, provenance: 'authored' }],
		}).success).toBe(false)
		expect(ringSystemSchema.safeParse({
			schemaVersion: 1, plane: 'parent-equatorial',
			bands: [
				{ innerRadiusM: 10, outerRadiusM: 20, provenance: 'authored' },
				{ innerRadiusM: 19, outerRadiusM: 30, provenance: 'authored' },
			],
		}).success).toBe(false)
	})

	it('does not coerce invalid or future data into a display model', () => {
		expect(parseRingSystem({ schemaVersion: 2, plane: 'parent-equatorial', bands: [] })).toBeNull()
		expect(parseRingSystem({ schemaVersion: 1, plane: 'arbitrary', bands: [] })).toBeNull()
	})
})
