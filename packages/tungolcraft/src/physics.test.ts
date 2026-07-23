import { describe, it, expect } from 'vitest'
import {
	computeDensity,
	computeSurfaceGravity,
	computeEscapeVelocity,
	computeRotationalBreakupPeriodS,
	computeRocheLimitM,
	computeOrbitalPeriodDays,
	computeMeanOrbitalSpeed,
	computeOrbitalSpeedAtRadius,
	computeCircularOrbitSpeed,
	computeHabitableZoneAu,
	computeHillSphereAu,
	computeLuminosity,
	deriveBodyOrbitalFields,
	deriveBodyFields,
	deriveHabitableZoneAu,
	deriveSystemType,
	kg, m, au, days, kelvin, watts,
	muFromMass, addMu, NOMINAL_SOLAR_GM,
} from './index.js'

const EARTH_MASS_KG = 5.972e24
const EARTH_RADIUS_M = 6.371e6
const SOLAR_MASS_KG = 1.989e30
const SOLAR_LUMINOSITY_W = 3.828e26

describe('physical formulas at Earth reference values', () => {
	it('density ≈ 5514 kg/m³', () => {
		expect(computeDensity(kg(EARTH_MASS_KG), m(EARTH_RADIUS_M))).toBeCloseTo(5514, -2)
	})

	it('surface gravity ≈ 9.8 m/s²', () => {
		expect(computeSurfaceGravity(kg(EARTH_MASS_KG), m(EARTH_RADIUS_M))).toBeCloseTo(9.82, 1)
	})

	it('escape velocity ≈ 11.19 km/s', () => {
		expect(computeEscapeVelocity(kg(EARTH_MASS_KG), m(EARTH_RADIUS_M)) / 1000).toBeCloseTo(11.19, 1)
	})
})

describe('computeRotationalBreakupPeriodS', () => {
	const earthDensity = computeDensity(kg(EARTH_MASS_KG), m(EARTH_RADIUS_M))

	it('gives Earth a break-up period of ~1.4 h (~84 min)', () => {
		expect(computeRotationalBreakupPeriodS(earthDensity) / 3600).toBeCloseTo(1.41, 1)
	})

	it('depends only on density: a denser body breaks up at a shorter period', () => {
		const denser = computeDensity(kg(EARTH_MASS_KG * 8), m(EARTH_RADIUS_M))
		expect(computeRotationalBreakupPeriodS(denser)).toBeLessThan(computeRotationalBreakupPeriodS(earthDensity))
		// 8× density → period scales as ρ^(-1/2) → 1/√8 of the original.
		expect(computeRotationalBreakupPeriodS(denser)).toBeCloseTo(computeRotationalBreakupPeriodS(earthDensity) / Math.sqrt(8), 5)
	})
})

describe('computeRocheLimitM (rigid vs fluid)', () => {
	const parentR = m(EARTH_RADIUS_M)
	const parentRho = computeDensity(kg(EARTH_MASS_KG), m(EARTH_RADIUS_M))
	const satRho = computeDensity(kg(EARTH_MASS_KG * 0.5), m(EARTH_RADIUS_M * 0.8))

	it('defaults to the rigid limit (coefficient 2^(1/3))', () => {
		const rigid = computeRocheLimitM(parentR, parentRho, satRho)
		expect(rigid).toBeCloseTo(EARTH_RADIUS_M * Math.cbrt((2 * parentRho) / satRho), 3)
	})

	it('places the fluid limit ~1.9× farther out than the rigid one', () => {
		const rigid = computeRocheLimitM(parentR, parentRho, satRho, 'rigid')
		const fluid = computeRocheLimitM(parentR, parentRho, satRho, 'fluid')
		expect(fluid).toBeGreaterThan(rigid)
		expect(fluid / rigid).toBeCloseTo(2.44 / Math.cbrt(2), 6)
	})
})

describe('computeOrbitalPeriodDays', () => {
	it('Earth around the Sun ≈ 365 days', () => {
		expect(computeOrbitalPeriodDays(au(1), muFromMass(kg(SOLAR_MASS_KG)))).toBeCloseTo(365, 0)
	})

	it('scales as a^(3/2) (Kepler III)', () => {
		const oneAu = computeOrbitalPeriodDays(au(1), muFromMass(kg(SOLAR_MASS_KG)))
		const fourAu = computeOrbitalPeriodDays(au(4), muFromMass(kg(SOLAR_MASS_KG)))
		expect(fourAu / oneAu).toBeCloseTo(8, 3) // 4^1.5 = 8
	})
})

describe('two-body μ and IAU nominal parameters', () => {
	it('muFromMass(M) reproduces the primary-only period', () => {
		expect(computeOrbitalPeriodDays(au(1), muFromMass(kg(SOLAR_MASS_KG)))).toBeCloseTo(365, 0)
	})

	it('an equal-mass binary orbits √2 faster than the primary alone (M+m matters)', () => {
		const a = au(1)
		const primaryOnly = computeOrbitalPeriodDays(a, muFromMass(kg(SOLAR_MASS_KG)))
		const bothStars = computeOrbitalPeriodDays(a, addMu(muFromMass(kg(SOLAR_MASS_KG)), muFromMass(kg(SOLAR_MASS_KG))))
		expect(primaryOnly / bothStars).toBeCloseTo(Math.SQRT2, 6)
	})

	it('adding a planet-scale companion barely shifts the period (M ≫ m limit)', () => {
		const a = au(1)
		const starOnly = computeOrbitalPeriodDays(a, muFromMass(kg(SOLAR_MASS_KG)))
		const withEarth = computeOrbitalPeriodDays(a, addMu(muFromMass(kg(SOLAR_MASS_KG)), muFromMass(kg(EARTH_MASS_KG))))
		expect(withEarth).toBeLessThan(starOnly)
		expect(starOnly / withEarth).toBeCloseTo(1, 5) // < 1e-5 relative
	})

	it('uses the IAU nominal solar GM directly for a 1 AU sidereal year', () => {
		// 2π√(AU³/GM☉ᴺ) — independent of the less-precise tabulated solar mass.
		expect(computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)).toBeCloseTo(365.25, 0)
	})
})

describe('computeMeanOrbitalSpeed', () => {
	const EARTH_YEAR_DAYS = 365.25

	it('Earth mean orbital speed ≈ 29.78 km/s', () => {
		const v = computeMeanOrbitalSpeed(au(1), days(EARTH_YEAR_DAYS))
		expect(v / 1000).toBeCloseTo(29.78, 1)
	})

	it('a circular orbit (e = 0) is exactly the 2πa/T of the old formula', () => {
		const a = au(1), t = days(EARTH_YEAR_DAYS)
		const circular = computeMeanOrbitalSpeed(a, t, 0)
		const AU_M = 1.495_978_707e11
		expect(circular).toBeCloseTo((2 * Math.PI * AU_M) / (EARTH_YEAR_DAYS * 86_400), 3)
	})

	it('an eccentric orbit travels slower on average than the circular 2πa/T (shorter perimeter than 2πa)', () => {
		const a = au(1), t = days(EARTH_YEAR_DAYS)
		expect(computeMeanOrbitalSpeed(a, t, 0.6)).toBeLessThan(computeMeanOrbitalSpeed(a, t, 0))
	})

	it('treats a null/out-of-range eccentricity as circular', () => {
		const a = au(1), t = days(EARTH_YEAR_DAYS)
		const circular = computeMeanOrbitalSpeed(a, t, 0)
		expect(computeMeanOrbitalSpeed(a, t, 1)).toBe(circular)
		expect(computeMeanOrbitalSpeed(a, t, -0.3)).toBe(circular)
	})
})

describe('computeOrbitalSpeedAtRadius (vis-viva)', () => {
	it('at r = a equals the circular speed √(μ/a) ≈ 29.78 km/s for Earth', () => {
		const v = computeOrbitalSpeedAtRadius(NOMINAL_SOLAR_GM, au(1), au(1))
		expect(v / 1000).toBeCloseTo(29.78, 1)
	})

	it('is faster at periapsis than at apoapsis', () => {
		const a = au(1), ecc = 0.2
		const peri = computeOrbitalSpeedAtRadius(NOMINAL_SOLAR_GM, au(1 - ecc), a)
		const apo = computeOrbitalSpeedAtRadius(NOMINAL_SOLAR_GM, au(1 + ecc), a)
		expect(peri).toBeGreaterThan(apo)
	})
})

describe('computeCircularOrbitSpeed', () => {
	it('Earth circular speed √(μ/r) ≈ 29.78 km/s at 1 AU', () => {
		expect(computeCircularOrbitSpeed(NOMINAL_SOLAR_GM, au(1)) / 1000).toBeCloseTo(29.78, 1)
	})

	it('equals vis-viva evaluated at r = a', () => {
		const circular = computeCircularOrbitSpeed(NOMINAL_SOLAR_GM, au(2.5))
		const visViva = computeOrbitalSpeedAtRadius(NOMINAL_SOLAR_GM, au(2.5), au(2.5))
		expect(circular).toBeCloseTo(visViva, 6)
	})
})

describe('computeLuminosity + habitable zone', () => {
	it('Sun radius/temp yields ~1 solar luminosity', () => {
		const l = computeLuminosity(m(6.9634e8), kelvin(5778))
		expect(l / SOLAR_LUMINOSITY_W).toBeCloseTo(1, 1)
	})

	it('habitable zone brackets 1 AU for a solar-luminosity star', () => {
		const hz = computeHabitableZoneAu(watts(SOLAR_LUMINOSITY_W))
		expect(hz.inner).toBeLessThan(1)
		expect(hz.outer).toBeGreaterThan(1)
	})
})

describe('computeHillSphereAu', () => {
	it('applies the (1 − e) periapsis factor for eccentric orbits', () => {
		const circular = computeHillSphereAu(au(1), kg(EARTH_MASS_KG), kg(SOLAR_MASS_KG))
		const eccentric = computeHillSphereAu(au(1), kg(EARTH_MASS_KG), kg(SOLAR_MASS_KG), 0.25)
		expect(eccentric).toBeCloseTo(circular * 0.75, 10)
	})

	it('treats a null/omitted/out-of-range eccentricity as circular', () => {
		const circular = computeHillSphereAu(au(1), kg(EARTH_MASS_KG), kg(SOLAR_MASS_KG))
		expect(computeHillSphereAu(au(1), kg(EARTH_MASS_KG), kg(SOLAR_MASS_KG), null)).toBe(circular)
		expect(computeHillSphereAu(au(1), kg(EARTH_MASS_KG), kg(SOLAR_MASS_KG), 1)).toBe(circular)
		expect(computeHillSphereAu(au(1), kg(EARTH_MASS_KG), kg(SOLAR_MASS_KG), -0.3)).toBe(circular)
	})
})

describe('deriveHabitableZoneAu', () => {
	it('uses explicit luminosity when present', () => {
		const hz = deriveHabitableZoneAu(SOLAR_LUMINOSITY_W, null, null)
		expect(hz).not.toBeNull()
		expect(hz!.inner).toBeLessThan(1)
		expect(hz!.outer).toBeGreaterThan(1)
	})

	it('falls back to Stefan-Boltzmann from radius + temperature', () => {
		const hz = deriveHabitableZoneAu(null, 6.9634e8, 5778)
		expect(hz).not.toBeNull()
		expect(hz!.inner).toBeLessThan(1.2)
		expect(hz!.outer).toBeGreaterThan(0.9)
	})

	it('is null when neither luminosity nor radius+temperature is available', () => {
		expect(deriveHabitableZoneAu(null, null, null)).toBeNull()
		expect(deriveHabitableZoneAu(null, 6.9634e8, null)).toBeNull()
	})
})

describe('deriveBodyOrbitalFields', () => {
	it('derives the period from Kepler when none is supplied', () => {
		const { orbitalPeriodDays } = deriveBodyOrbitalFields(1, null, EARTH_MASS_KG, SOLAR_MASS_KG)
		expect(orbitalPeriodDays).toBeCloseTo(365, 0)
	})

	it('keeps an explicit period over the derived one', () => {
		const { orbitalPeriodDays } = deriveBodyOrbitalFields(1, 400, EARTH_MASS_KG, SOLAR_MASS_KG)
		expect(orbitalPeriodDays).toBe(400)
	})

	it('returns nulls when inputs are missing', () => {
		expect(deriveBodyOrbitalFields(null, null, null, null)).toEqual({
			orbitalPeriodDays: null,
			meanOrbitalSpeed: null,
			hillSphere: null,
		})
	})
})

describe('deriveSystemType', () => {
	it('names the star count', () => {
		expect(deriveSystemType(1)).toBe('single')
		expect(deriveSystemType(2)).toBe('binary')
		expect(deriveSystemType(3)).toBe('trinary')
		expect(deriveSystemType(4)).toBe('multiple')
		expect(deriveSystemType(9)).toBe('multiple')
	})

	it('reads a zero-star system as single', () => {
		expect(deriveSystemType(0)).toBe('single')
	})
})

describe('deriveBodyFields', () => {
	it('returns null fields for non-positive inputs', () => {
		expect(deriveBodyFields(0, 100)).toEqual({ density: null, surfaceGravity: null, escapeVelocity: null })
		expect(deriveBodyFields(100, -1)).toEqual({ density: null, surfaceGravity: null, escapeVelocity: null })
	})

	it('produces formatted strings for valid inputs', () => {
		const fields = deriveBodyFields(EARTH_MASS_KG, EARTH_RADIUS_M)
		expect(fields.density).toMatch(/g\/cm³/)
		expect(fields.surfaceGravity).toMatch(/m\/s²/)
		expect(fields.escapeVelocity).toMatch(/km\/s/)
	})
})
