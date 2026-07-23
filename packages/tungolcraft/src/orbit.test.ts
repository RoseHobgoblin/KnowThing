import { describe, it, expect } from 'vitest'
import {
	meanAnomaly, solveKeplerE, meanMotion, trueAnomaly,
	stateVectorAtTrueAnomaly, velocityAtTrueAnomaly, stateVectorAtEpoch,
	validateOrbitalElements, OrbitalDomainError,
	type OrbitalElements,
} from './orbit.js'
import { au, NOMINAL_SOLAR_GM } from './index.js'

const AU_M = 1.495_978_707e11

/** An Earth-scale, eccentric, un-tilted orbit around a Sun-mass primary. */
const ORBIT: OrbitalElements = {
	semiMajorAxisAu: au(1),
	eccentricity: 0.2,
	inclinationDeg: 0,
	longitudeAscendingNodeDeg: 0,
	argumentOfPeriapsisDeg: 0,
	epochPhase: 0,
	mu: NOMINAL_SOLAR_GM,
}

const magnitude = (v: { x: number, y: number, z: number }) => Math.hypot(v.x, v.y, v.z)

describe('meanAnomaly', () => {
	it('rejects a zero period instead of manufacturing an anomaly', () => {
		expect(() => meanAnomaly(0, 0, 100)).toThrow(OrbitalDomainError)
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

	it('throws on unbound eccentricity (e ≥ 1) instead of silently clamping', () => {
		expect(() => solveKeplerE(1, 1)).toThrow(RangeError)
		expect(() => solveKeplerE(1, 1.5)).toThrow(RangeError)
	})

	it('throws on negative eccentricity', () => {
		expect(() => solveKeplerE(1, -0.1)).toThrow(RangeError)
	})

	it('stays converged across a dense high-eccentricity grid', () => {
		for (const ecc of [0.9, 0.99, 0.999, 0.9999, 0.999_999]) {
			for (let index = 0; index <= 720; index++) {
				const M = 2 * Math.PI * index / 720
				const E = solveKeplerE(M, ecc)
				expect(Math.abs(E - ecc * Math.sin(E) - M)).toBeLessThan(2e-12)
			}
		}
	})
})

describe('orbital-domain validation', () => {
	it('reports every invalid public element rather than relying on an app schema', () => {
		const issues = validateOrbitalElements({
			...ORBIT,
			semiMajorAxisAu: au(-1),
			eccentricity: 1,
			inclinationDeg: Number.NaN,
			mu: 0 as OrbitalElements['mu'],
		})
		expect(issues.map(issue => issue.field)).toEqual(expect.arrayContaining([
			'semiMajorAxisAu', 'eccentricity', 'inclinationDeg', 'mu',
		]))
	})

	it('rejects invalid elements at both state-vector entry points', () => {
		const invalid = { ...ORBIT, eccentricity: 1 }
		expect(() => stateVectorAtTrueAnomaly(invalid, 0)).toThrow(OrbitalDomainError)
		expect(() => stateVectorAtEpoch(invalid, 0)).toThrow(OrbitalDomainError)
		expect(() => stateVectorAtTrueAnomaly(ORBIT, Number.NaN)).toThrow(OrbitalDomainError)
	})
})

describe('meanMotion', () => {
	it('implies a ~365.25-day period for a 1 AU orbit around a Sun-mass primary', () => {
		const n = meanMotion(NOMINAL_SOLAR_GM, au(1))
		const periodDays = (2 * Math.PI) / n / 86_400
		expect(periodDays).toBeCloseTo(365.25, 0)
	})

	it('scales as a^(−3/2)', () => {
		const inner = meanMotion(NOMINAL_SOLAR_GM, au(1))
		const outer = meanMotion(NOMINAL_SOLAR_GM, au(4))
		expect(inner / outer).toBeCloseTo(8, 6) // 4^(3/2)
	})
})

describe('trueAnomaly', () => {
	it('equals the eccentric anomaly for a circular orbit', () => {
		expect(trueAnomaly(1, 0)).toBeCloseTo(1, 12)
	})

	it('agrees at the apsides for any eccentricity', () => {
		expect(trueAnomaly(0, 0.6)).toBeCloseTo(0, 12) // periapsis
		expect(trueAnomaly(Math.PI, 0.6)).toBeCloseTo(Math.PI, 12) // apoapsis
	})

	it('runs ahead of the eccentric anomaly between the apsides', () => {
		expect(trueAnomaly(1, 0.6)).toBeGreaterThan(1)
	})
})

describe('stateVectorAtTrueAnomaly', () => {
	it('places periapsis at a(1−e) along +x with no orbit orientation', () => {
		const s = stateVectorAtTrueAnomaly(ORBIT, 0)
		expect(magnitude(s.position) / AU_M).toBeCloseTo(0.8, 6)
		expect(s.position.x).toBeGreaterThan(0)
		expect(Math.abs(s.position.y) / AU_M).toBeCloseTo(0, 6)
		expect(s.position.z).toBe(0)
	})

	it('velocity at periapsis is purely prograde (+y) and fastest', () => {
		const peri = stateVectorAtTrueAnomaly(ORBIT, 0)
		const apo = stateVectorAtTrueAnomaly(ORBIT, Math.PI)
		expect(Math.abs(peri.velocity.x)).toBeLessThan(1e-3)
		expect(peri.velocity.y).toBeGreaterThan(0)
		expect(magnitude(peri.velocity)).toBeGreaterThan(magnitude(apo.velocity))
	})

	it('satisfies the vis-viva identity |v|² = μ(2/r − 1/a) at an arbitrary point', () => {
		const s = stateVectorAtTrueAnomaly(ORBIT, 1.2)
		const r = magnitude(s.position)
		const a = 1 * AU_M
		const visViva = NOMINAL_SOLAR_GM * (2 / r - 1 / a)
		expect(magnitude(s.velocity) ** 2 / visViva).toBeCloseTo(1, 9)
	})

	it('a 90° inclination throws the body fully out of the reference plane', () => {
		const polar: OrbitalElements = { ...ORBIT, eccentricity: 0, inclinationDeg: 90 }
		const s = stateVectorAtTrueAnomaly(polar, Math.PI / 2)
		const r = magnitude(s.position)
		expect(Math.abs(s.position.z) / r).toBeCloseTo(1, 6)
		expect(Math.abs(s.position.x) / r).toBeCloseTo(0, 6)
	})
})

describe('velocityAtTrueAnomaly', () => {
	it('is exactly the velocity half of the full state vector', () => {
		expect(velocityAtTrueAnomaly(ORBIT, 0.7)).toEqual(stateVectorAtTrueAnomaly(ORBIT, 0.7).velocity)
	})
})

describe('stateVectorAtEpoch', () => {
	it('sits at periapsis at day 0 when epochPhase is 0', () => {
		const r = magnitude(stateVectorAtEpoch(ORBIT, 0).position)
		expect(r / AU_M).toBeCloseTo(0.8, 6) // a(1−e)
	})

	it('stays within [a(1−e), a(1+e)] for any day', () => {
		for (const day of [30, 91.3, 200, 364]) {
			const r = magnitude(stateVectorAtEpoch(ORBIT, day).position) / AU_M
			expect(r).toBeGreaterThanOrEqual(0.8 - 1e-9)
			expect(r).toBeLessThanOrEqual(1.2 + 1e-9)
		}
	})

	it('reaches apoapsis half a period after epoch (epochPhase 0.5)', () => {
		const half: OrbitalElements = { ...ORBIT, epochPhase: 0.5 }
		const r = magnitude(stateVectorAtEpoch(half, 0).position) / AU_M
		expect(r).toBeCloseTo(1.2, 6) // a(1+e)
	})
})
