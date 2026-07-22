import { describe, it, expect } from 'vitest'
import {
	computeDensity,
	computeSurfaceGravity,
	computeEscapeVelocity,
	computeOrbitalPeriodDays,
	computeHabitableZoneAu,
	computeHillSphereAu,
	computeLuminosity,
	deriveBodyOrbitalFields,
	deriveBodyFields,
	deriveHabitableZoneAu,
	deriveSystemType,
} from './index.js'

const EARTH_MASS_KG = 5.972e24
const EARTH_RADIUS_M = 6.371e6
const SOLAR_MASS_KG = 1.989e30
const SOLAR_LUMINOSITY_W = 3.828e26

describe('physical formulas at Earth reference values', () => {
	it('density ≈ 5514 kg/m³', () => {
		expect(computeDensity(EARTH_MASS_KG, EARTH_RADIUS_M)).toBeCloseTo(5514, -2)
	})

	it('surface gravity ≈ 9.8 m/s²', () => {
		expect(computeSurfaceGravity(EARTH_MASS_KG, EARTH_RADIUS_M)).toBeCloseTo(9.82, 1)
	})

	it('escape velocity ≈ 11.19 km/s', () => {
		expect(computeEscapeVelocity(EARTH_MASS_KG, EARTH_RADIUS_M) / 1000).toBeCloseTo(11.19, 1)
	})
})

describe('computeOrbitalPeriodDays', () => {
	it('Earth around the Sun ≈ 365 days', () => {
		expect(computeOrbitalPeriodDays(1, SOLAR_MASS_KG)).toBeCloseTo(365, 0)
	})

	it('scales as a^(3/2) (Kepler III)', () => {
		const oneAu = computeOrbitalPeriodDays(1, SOLAR_MASS_KG)
		const fourAu = computeOrbitalPeriodDays(4, SOLAR_MASS_KG)
		expect(fourAu / oneAu).toBeCloseTo(8, 3) // 4^1.5 = 8
	})
})

describe('computeLuminosity + habitable zone', () => {
	it('Sun radius/temp yields ~1 solar luminosity', () => {
		const l = computeLuminosity(6.9634e8, 5778)
		expect(l / SOLAR_LUMINOSITY_W).toBeCloseTo(1, 1)
	})

	it('habitable zone brackets 1 AU for a solar-luminosity star', () => {
		const hz = computeHabitableZoneAu(SOLAR_LUMINOSITY_W)
		expect(hz.inner).toBeLessThan(1)
		expect(hz.outer).toBeGreaterThan(1)
	})
})

describe('computeHillSphereAu', () => {
	it('applies the (1 − e) periapsis factor for eccentric orbits', () => {
		const circular = computeHillSphereAu(1, EARTH_MASS_KG, SOLAR_MASS_KG)
		const eccentric = computeHillSphereAu(1, EARTH_MASS_KG, SOLAR_MASS_KG, 0.25)
		expect(eccentric).toBeCloseTo(circular * 0.75, 10)
	})

	it('treats a null/omitted/out-of-range eccentricity as circular', () => {
		const circular = computeHillSphereAu(1, EARTH_MASS_KG, SOLAR_MASS_KG)
		expect(computeHillSphereAu(1, EARTH_MASS_KG, SOLAR_MASS_KG, null)).toBe(circular)
		expect(computeHillSphereAu(1, EARTH_MASS_KG, SOLAR_MASS_KG, 1)).toBe(circular)
		expect(computeHillSphereAu(1, EARTH_MASS_KG, SOLAR_MASS_KG, -0.3)).toBe(circular)
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
			orbitalVelocity: null,
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
