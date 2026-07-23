import { describe, it, expect } from 'vitest'
import { validateBodyPhysics, validateStarPhysics } from './validate.js'

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

describe('validateBodyPhysics — rotational break-up', () => {
	// Earth's density (~5.5 g/cm³) sets a break-up period of ~1.4 h (√(3π/Gρ)).
	it('flags a body spinning faster than its density-set break-up period, with no orbital period entered', () => {
		// Regression: the warning used to be gated behind orbitalPeriodDays != null,
		// so a newly-created body (no period yet) never got the check.
		const warnings = body({ rotationPeriodS: 1800, massKg: EARTH_MASS, radiusM: EARTH_RADIUS, orbitalPeriodDays: null })
		expect(warnings.some(w => w.field === 'rotationPeriodS' && /break-up period/.test(w.message))).toBe(true)
	})

	it('does not flag a slow rotator', () => {
		const warnings = body({ rotationPeriodS: 86_400, massKg: EARTH_MASS, radiusM: EARTH_RADIUS })
		expect(warnings.some(w => w.field === 'rotationPeriodS')).toBe(false)
	})

	it('is silent without a radius — the check is a density equation, not a fixed rule', () => {
		const warnings = body({ rotationPeriodS: 1, massKg: EARTH_MASS, radiusM: null })
		expect(warnings.some(w => w.field === 'rotationPeriodS')).toBe(false)
	})

	it('tolerates a fast spin for a very dense body that a fixed one-hour rule would have flagged', () => {
		// A neutron-star-like density spins stably far under an hour: raising density
		// shortens the break-up period below the spin, unlike the old flat threshold.
		const warnings = body({ rotationPeriodS: 60, massKg: 1e28, radiusM: 1e5 })
		expect(warnings.some(w => w.field === 'rotationPeriodS')).toBe(false)
	})
})

describe('validateBodyPhysics — satellite mass ratio', () => {
	it('flags a satellite too heavy relative to its parent (double-body regime)', () => {
		const warnings = body({ isSatellite: true, massKg: 0.2 * EARTH_MASS, parentMassKg: EARTH_MASS })
		expect(warnings.some(w => w.field === 'massKg' && /mass ratio/.test(w.message))).toBe(true)
	})

	it('accepts an ordinary low-ratio moon', () => {
		const warnings = body({ isSatellite: true, massKg: 0.012 * EARTH_MASS, parentMassKg: EARTH_MASS })
		expect(warnings.some(w => w.field === 'massKg')).toBe(false)
	})

	it('cannot judge the ratio without a parent mass', () => {
		const warnings = body({ isSatellite: true, massKg: 5 * EARTH_MASS, parentMassKg: null })
		expect(warnings.some(w => w.field === 'massKg')).toBe(false)
	})
})

describe('validateBodyPhysics — Hill-fraction stability', () => {
	// Same 0.006 AU orbit, opposite verdicts: past 0.5 Hill (0.005) but inside 0.7 (0.007).
	it('flags a prograde moon past ~0.5 Hill even while still inside the Hill sphere', () => {
		const warnings = body({ isSatellite: true, semiMajorAxisAu: 0.006, parentHillAu: 0.01 })
		expect(warnings.some(w => w.field === 'semiMajorAxisAu' && /Hill radius/.test(w.message))).toBe(true)
		expect(warnings.some(w => /Hill sphere/.test(w.message))).toBe(false)
	})

	it('lets a retrograde moon hold on farther out (~0.7 Hill)', () => {
		const warnings = body({ isSatellite: true, semiMajorAxisAu: 0.006, parentHillAu: 0.01, satelliteOrbitSense: 'retrograde' })
		expect(warnings.some(w => w.field === 'semiMajorAxisAu')).toBe(false)
	})

	it('still calls out an orbit beyond the full Hill sphere as unbound', () => {
		const warnings = body({ isSatellite: true, semiMajorAxisAu: 0.05, parentHillAu: 0.01 })
		expect(warnings.some(w => /Hill sphere/.test(w.message) && /stripped away/.test(w.message))).toBe(true)
	})
})

describe('validateBodyPhysics — axial tilt convention', () => {
	it('accepts a tilt within the 0–180° obliquity range', () => {
		expect(body({ axialTilt: 23.44 }).some(w => w.field === 'axialTilt')).toBe(false)
		expect(body({ axialTilt: 177 }).some(w => w.field === 'axialTilt')).toBe(false)
	})

	it('flags a tilt above 180° as a non-canonical duplicate', () => {
		expect(body({ axialTilt: 200 }).some(w => w.field === 'axialTilt' && /obliquity convention/.test(w.message))).toBe(true)
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

describe('validateBodyPhysics — density outliers', () => {
	// A tiny radius on an Earth mass drives density far past any ordinary solid.
	it('flags an implausibly dense body without naming a physical regime', () => {
		const warnings = body({ massKg: EARTH_MASS, radiusM: EARTH_RADIUS / 20 })
		const density = warnings.find(w => w.field === 'density')
		expect(density).toBeDefined()
		expect(density!.message).toMatch(/outlier/)
		// Regression: must not resurrect the self-contradictory regime claim.
		expect(density!.message).not.toMatch(/neutron|white dwarf|degenerate/i)
	})

	it('flags an implausibly diffuse body regardless of body type', () => {
		const warnings = body({ massKg: EARTH_MASS, radiusM: EARTH_RADIUS * 20, bodyType: 'asteroid' })
		expect(warnings.some(w => w.field === 'density' && /outlier/.test(w.message))).toBe(true)
	})

	it('accepts an ordinary rocky density', () => {
		const warnings = body({ massKg: EARTH_MASS, radiusM: EARTH_RADIUS })
		expect(warnings.some(w => w.field === 'density')).toBe(false)
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
