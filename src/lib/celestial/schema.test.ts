import { describe, it, expect } from 'vitest'
import {
	createPlanetaryBodySchema,
	updatePlanetaryBodySchema,
	createStarSchema,
	updateStarSchema,
	legacySafeEccentricity,
} from './schema.js'

describe('planetary body schema', () => {
	it('create requires a parent', () => {
		const result = createPlanetaryBodySchema.safeParse({ name: 'X', slug: 'x' })
		expect(result.success).toBe(false)
	})

	it('create accepts a body assigned to a parent', () => {
		const result = createPlanetaryBodySchema.safeParse({ name: 'X', slug: 'x', parentId: 1 })
		expect(result.success).toBe(true)
	})

	it('update accepts a partial patch that omits parentId (regression)', () => {
		// Previously the shared refinement flagged the absent parent and rejected
		// every partial update that did not resend the whole record.
		const result = updatePlanetaryBodySchema.safeParse({ name: 'Renamed' })
		expect(result.success).toBe(true)
	})

	it('update still rejects an explicitly cleared parentId', () => {
		const result = updatePlanetaryBodySchema.safeParse({ parentId: null })
		expect(result.success).toBe(false)
	})

	it('rejects eccentricity of 1 (unbound orbit)', () => {
		expect(createPlanetaryBodySchema.safeParse({ name: 'X', slug: 'x', parentId: 1, eccentricity: 1 }).success).toBe(false)
	})

	it('accepts eccentricity just below 1', () => {
		expect(createPlanetaryBodySchema.safeParse({ name: 'X', slug: 'x', parentId: 1, eccentricity: 0.99 }).success).toBe(true)
	})

	it('carries display-string overrides through parsing', () => {
		const result = createPlanetaryBodySchema.safeParse({ name: 'X', slug: 'x', parentId: 1, density: '10 g/cm³' })
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.density).toBe('10 g/cm³')
	})
})

describe('star schema', () => {
	it('create requires a parent when orbital data is present', () => {
		const result = createStarSchema.safeParse({ name: 'B', slug: 'b', semiMajorAxisAu: 20 })
		expect(result.success).toBe(false)
	})

	it('create accepts a field star without orbital data', () => {
		const result = createStarSchema.safeParse({ name: 'B', slug: 'b' })
		expect(result.success).toBe(true)
	})

	it('update accepts a lone eccentricity patch without a parent (regression)', () => {
		const result = updateStarSchema.safeParse({ eccentricity: 0.2 })
		expect(result.success).toBe(true)
	})

	it('update rejects orbital data with an explicitly null parent', () => {
		const result = updateStarSchema.safeParse({ semiMajorAxisAu: 20, parentId: null })
		expect(result.success).toBe(false)
	})
})

describe('legacySafeEccentricity', () => {
	// The merge re-validation in updateCelestial re-parses {...current, ...patch}
	// with the create schema. A legacy row saved at e = 1 (valid before the bound was
	// tightened to < 1) must not brick every future edit — its stored value is clamped
	// for the validation snapshot so an unrelated patch still merges cleanly.
	it('clamps a stored e = 1 into the bound range so the merged row still validates', () => {
		const current = { name: 'Legacy', slug: 'legacy', parentId: 1, eccentricity: 1 }
		const patch = { name: 'Renamed' }
		const merged = createPlanetaryBodySchema.safeParse({
			...current,
			eccentricity: legacySafeEccentricity(current.eccentricity),
			...patch,
		})
		expect(merged.success).toBe(true)
	})

	it('passes valid, null, and out-of-range values through as expected', () => {
		expect(legacySafeEccentricity(0.3)).toBe(0.3)
		expect(legacySafeEccentricity(null)).toBeNull()
		expect(legacySafeEccentricity(undefined)).toBeNull()
		expect(legacySafeEccentricity(1)).toBeLessThan(1)
		expect(legacySafeEccentricity(1.5)).toBeLessThan(1)
		expect(legacySafeEccentricity(-0.2)).toBe(0)
	})
})
