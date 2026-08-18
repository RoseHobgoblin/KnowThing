import { describe, expect, it } from 'vitest'
import { placeRootLabel } from './root-label-layout.js'

describe('root label pillars', () => {
	it('gives converged body anchors distinct vertical tiers', () => {
		const first = placeRootLabel(200, 200, 5, 400, [])
		const second = placeRootLabel(200, 200, 5, 400, [first])
		expect(second.x).toBe(first.x)
		expect(second.y).toBeLessThan(first.y)
		expect(first.pillar.x).toBe(200)
		expect(first.pillar.toY).toBe(first.y + 14)
	})

	it('moves below the body when there is no room for an upper pillar', () => {
		const placement = placeRootLabel(80, 10, 5, 200, [])
		expect(placement.y).toBeGreaterThan(10)
		expect(placement.pillar.fromY).toBe(15)
		expect(placement.pillar.toY).toBe(placement.y)
	})
})
