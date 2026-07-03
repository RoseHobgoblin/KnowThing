import { describe, it, expect } from 'vitest'
import { validateBodyPhysics, validateStarPhysics } from './validate-physics.js'

const EARTH_MASS = 5.972e24
const EARTH_RADIUS = 6.371e6
const SOLAR_MASS = 1.989e30

/** Minimal body params with everything off unless a test sets it. */
function body(overrides: Partial<Parameters<typeof validateBodyPhysics>[0]> = {}) {
	return validateBodyPhysics({
		massKg: null,
		radiusM: null,
		orbitalPeriodDays: null,
		semiMajorAxisAu: null,
		eccentricity: null,
		rotationPeriodS: null,
		axialTilt: null,
		bodyType: 'planet',
		isSatellite: false,
		...overrides,
	})
}

describe('validateBodyPhysics — orbit crossing', () => {
	it('flags a planet whose radial band overlaps a sibling', () => {
		const warnings = body({
			semiMajorAxisAu: 1,
			eccentricity: 0.4, // apoapsis 1.4 AU
			siblingOrbits: [{ name: 'Neighbour', semiMajorAxisAu: 1.5, eccentricity: 0.1 }], // periapsis 1.35 AU
		})
		expect(warnings.some(w => w.field === 'semiMajorAxisAu' && /overlaps Neighbour/.test(w.message))).toBe(true)
	})

	it('does not flag well-separated circular orbits', () => {
		const warnings = body({
			semiMajorAxisAu: 1,
			eccentricity: 0,
			siblingOrbits: [{ name: 'Far', semiMajorAxisAu: 5, eccentricity: 0 }],
		})
		expect(warnings.some(w => /overlaps/.test(w.message))).toBe(false)
	})

	it('ignores sibling crossings for satellites', () => {
		const warnings = body({
			isSatellite: true,
			semiMajorAxisAu: 1,
			siblingOrbits: [{ name: 'Planet', semiMajorAxisAu: 1, eccentricity: 0 }],
		})
		expect(warnings.some(w => /overlaps/.test(w.message))).toBe(false)
	})
})

describe('validateBodyPhysics — Hill-sphere containment', () => {
	it('flags a moon orbiting beyond the parent Hill sphere', () => {
		// Earth's Hill sphere is ~0.01 AU; a moon at 0.05 AU is unbound.
		const warnings = body({ isSatellite: true, semiMajorAxisAu: 0.05, parentHillAu: 0.01 })
		expect(warnings.some(w => /Hill sphere/.test(w.message))).toBe(true)
	})

	it('does not flag a moon safely inside the Hill sphere', () => {
		const warnings = body({ isSatellite: true, semiMajorAxisAu: 0.0026, parentHillAu: 0.01 })
		expect(warnings.some(w => /Hill sphere/.test(w.message))).toBe(false)
	})
})

describe('validateStarPhysics — temperature vs spectral class', () => {
	it('flags a G-class star that is far too hot', () => {
		const warnings = validateStarPhysics({
			massKg: SOLAR_MASS, radiusM: null, semiMajorAxisAu: null, eccentricity: null,
			temperatureK: 30_000, spectralType: 'G2V',
		})
		expect(warnings.some(w => w.field === 'temperatureK' && /spectral class G/.test(w.message))).toBe(true)
	})

	it('accepts a Sun-like G2V at 5772 K', () => {
		const warnings = validateStarPhysics({
			massKg: SOLAR_MASS, radiusM: null, semiMajorAxisAu: null, eccentricity: null,
			temperatureK: 5772, spectralType: 'G2V',
		})
		expect(warnings.some(w => w.field === 'temperatureK')).toBe(false)
	})

	it('is silent when no spectral type is given', () => {
		const warnings = validateStarPhysics({
			massKg: null, radiusM: null, semiMajorAxisAu: null, eccentricity: null,
			temperatureK: 5772, spectralType: null,
		})
		expect(warnings.some(w => w.field === 'temperatureK')).toBe(false)
	})
})

describe('validateBodyPhysics — existing checks still hold', () => {
	it('flags non-positive mass', () => {
		expect(body({ massKg: -1 }).some(w => w.severity === 'impossible')).toBe(true)
	})

	it('accepts an Earth-like body', () => {
		const warnings = body({ massKg: EARTH_MASS, radiusM: EARTH_RADIUS, semiMajorAxisAu: 1, eccentricity: 0.0167 })
		expect(warnings).toHaveLength(0)
	})
})
