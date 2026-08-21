import { describe, expect, it } from 'vitest'
import { projectRingSystems } from './public/ring-projection.js'

describe('ring-system map projection', () => {
	it('attaches valid children to their parent and removes them from sphere topology', () => {
		const rows = projectRingSystems([
			{ id: 1, name: 'Parent', slug: 'parent', bodyType: 'planet' },
			{
				id: 2, name: 'Main rings', slug: 'main-rings', bodyType: 'ring_system', parentId: 1,
				ringSystem: {
					schemaVersion: 1, plane: 'parent-equatorial',
					bands: [{ innerRadiusM: 10, outerRadiusM: 20, provenance: 'authored' }],
				},
			},
		])
		expect(rows).toHaveLength(1)
		expect(rows[0].ringSystems).toMatchObject([{ id: 2, name: 'Main rings' }])
	})

	it('preserves an explicit empty ring system without inventing bands', () => {
		const [explicitEmpty] = projectRingSystems([
			{ id: 1, name: 'Parent', slug: 'parent', bodyType: 'planet' },
			{
				id: 2, name: 'Empty', slug: 'empty', bodyType: 'ring_system', parentId: 1,
				ringSystem: { schemaVersion: 1, plane: 'parent-equatorial', bands: [] },
			},
		])
		expect(explicitEmpty.ringSystems[0].ringSystem.bands).toEqual([])
	})
})
