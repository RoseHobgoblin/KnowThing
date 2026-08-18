import { describe, it, expect } from 'vitest'
import {
	createPlanetaryBodySchema,
	updatePlanetaryBodySchema,
	createStarSchema,
	updateStarSchema,
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

	it('does not include the retired free-text albedo field', () => {
		const result = createPlanetaryBodySchema.safeParse({ name: 'X', slug: 'x', parentId: 1, albedo: '0.3' })
		expect(result.success).toBe(true)
		if (result.success) expect(result.data).not.toHaveProperty('albedo')
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
