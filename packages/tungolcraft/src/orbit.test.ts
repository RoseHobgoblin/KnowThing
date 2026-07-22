import { describe, it, expect } from 'vitest'
import { meanAnomaly, solveKeplerE } from './orbit.js'

describe('meanAnomaly', () => {
	it('returns 0 for zero period', () => {
		expect(meanAnomaly(0, 0, 100)).toBe(0)
	})

	it('returns 0 at day 0 with zero epoch phase', () => {
		expect(meanAnomaly(365, 0, 0)).toBe(0)
	})

	it('returns π at half orbit', () => {
		expect(meanAnomaly(100, 0, 50)).toBeCloseTo(Math.PI, 10)
	})

	it('wraps to [0, 2π)', () => {
		const result = meanAnomaly(100, 0, 250)
		expect(result).toBeGreaterThanOrEqual(0)
		expect(result).toBeLessThan(Math.PI * 2)
		expect(result).toBeCloseTo(Math.PI, 10)
	})

	it('accounts for epoch phase', () => {
		// epochPhase 0.25 = quarter orbit ahead at day 0
		const result = meanAnomaly(100, 0.25, 0)
		expect(result).toBeCloseTo(Math.PI / 2, 10)
	})

	it('handles negative days', () => {
		const result = meanAnomaly(100, 0, -25)
		expect(result).toBeGreaterThanOrEqual(0)
		expect(result).toBeLessThan(Math.PI * 2)
		expect(result).toBeCloseTo(Math.PI * 1.5, 10)
	})
})

describe('solveKeplerE', () => {
	it('returns M for circular orbit (ecc=0)', () => {
		expect(solveKeplerE(1, 0)).toBeCloseTo(1, 12)
		expect(solveKeplerE(Math.PI, 0)).toBeCloseTo(Math.PI, 12)
	})

	it('satisfies Kepler equation M = E - ecc*sin(E)', () => {
		const testCases = [
			{ M: 0.5, ecc: 0.1 },
			{ M: 1, ecc: 0.3 },
			{ M: 2, ecc: 0.5 },
			{ M: 3, ecc: 0.7 },
			{ M: 0.1, ecc: 0.9 },
			{ M: Math.PI, ecc: 0.6 },
		]

		for (const { M, ecc } of testCases) {
			const E = solveKeplerE(M, ecc)
			const reconstructedM = E - ecc * Math.sin(E)
			expect(reconstructedM).toBeCloseTo(M, 10)
		}
	})

	it('converges for high eccentricity near periapsis', () => {
		const M = 0.01
		const ecc = 0.95
		const E = solveKeplerE(M, ecc)
		expect(E - ecc * Math.sin(E)).toBeCloseTo(M, 10)
	})

	it('returns 0 for M=0', () => {
		expect(solveKeplerE(0, 0.5)).toBeCloseTo(0, 12)
	})

	it('returns π for M=π (apoapsis)', () => {
		// At M=π, E=π is exact for any ecc (sin(π)=0)
		expect(solveKeplerE(Math.PI, 0.9)).toBeCloseTo(Math.PI, 10)
	})
})
