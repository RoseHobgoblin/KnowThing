import { describe, expect, it } from 'vitest'
import { createSectorSchema } from './public/sector-schema.js'

const base = { name: 'Local Sector', slug: 'local-sector' }

describe('sector frame schema', () => {
	it('defaults an authored right-handed light-year frame', () => {
		const parsed = createSectorSchema.parse(base)
		expect(parsed).toMatchObject({
			units: 'ly', shape: null, originKind: 'frame-centred',
			handedness: 'right-handed', provenance: 'authored',
		})
	})

	it('requires the extent declared by the selected shape', () => {
		expect(createSectorSchema.safeParse({ ...base, shape: 'sphere' }).success).toBe(false)
		expect(createSectorSchema.safeParse({ ...base, shape: 'sphere', radius: 20 }).success).toBe(true)
		expect(createSectorSchema.safeParse({ ...base, shape: 'cuboid', extentX: 20, extentY: 15 }).success).toBe(false)
		expect(createSectorSchema.safeParse({ ...base, shape: 'cuboid', extentX: 20, extentY: 15, extentZ: 10 }).success).toBe(true)
	})

	it('requires an origin system for an object-centred frame', () => {
		expect(createSectorSchema.safeParse({ ...base, originKind: 'object-centred' }).success).toBe(false)
		expect(createSectorSchema.safeParse({ ...base, originKind: 'object-centred', originBodyId: 42 }).success).toBe(true)
	})

	it('rejects ambiguous URL slugs', () => {
		expect(createSectorSchema.safeParse({ ...base, slug: 'Local Sector' }).success).toBe(false)
		expect(createSectorSchema.safeParse({ ...base, slug: 'local--sector' }).success).toBe(false)
	})
})
