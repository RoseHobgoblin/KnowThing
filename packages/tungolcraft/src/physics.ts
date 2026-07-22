/**
 * Closed-form astrophysical formulas. Pure functions, SI units in and out.
 * Given a body's raw numbers (mass, radius, semi-major axis, …), derive the
 * rest — density, gravity, escape velocity, orbital mechanics, Roche/Hill
 * limits, habitable zone, luminosity.
 */

import { G, AU_M, STEFAN_BOLTZMANN, SOLAR_LUMINOSITY } from './constants.js'

/** density = 3M / (4πr³) → kg/m³ */
export function computeDensity(massKg: number, radiusM: number): number {
	return massKg / ((4 / 3) * Math.PI * radiusM ** 3)
}

/** surface gravity = GM/r² → m/s² */
export function computeSurfaceGravity(massKg: number, radiusM: number): number {
	return (G * massKg) / radiusM ** 2
}

/** escape velocity = √(2GM/r) → m/s */
export function computeEscapeVelocity(massKg: number, radiusM: number): number {
	return Math.sqrt((2 * G * massKg) / radiusM)
}

/** orbital period via Kepler's third law: T = 2π√(a³/GM) → days */
export function computeOrbitalPeriodDays(semiMajorAxisAu: number, parentMassKg: number): number {
	const a = semiMajorAxisAu * AU_M
	const seconds = 2 * Math.PI * Math.sqrt(a ** 3 / (G * parentMassKg))
	return seconds / 86_400
}

/** mean orbital velocity: v = 2πa / T → m/s */
export function computeOrbitalVelocity(semiMajorAxisAu: number, orbitalPeriodDays: number): number {
	const a = semiMajorAxisAu * AU_M
	return (2 * Math.PI * a) / (orbitalPeriodDays * 86_400)
}

/**
 * Hill sphere radius: r_H ≈ a(1 − e) × (m / 3M)^(1/3) → AU.
 * The (1 − e) periapsis factor matters for eccentric orbits — the sphere is
 * smallest (and containment tightest) at closest approach. A null or
 * out-of-range eccentricity is treated as a circular orbit.
 */
export function computeHillSphereAu(semiMajorAxisAu: number, bodyMassKg: number, parentMassKg: number, eccentricity: number | null = null): number {
	const ecc = eccentricity != null && eccentricity > 0 && eccentricity < 1 ? eccentricity : 0
	return semiMajorAxisAu * (1 - ecc) * Math.cbrt(bodyMassKg / (3 * parentMassKg))
}

/** Roche limit (rigid body): d ≈ R_parent × (2 × ρ_parent / ρ_sat)^(1/3) → metres */
export function computeRocheLimitM(parentRadiusM: number, parentDensity: number, bodyDensity: number): number {
	return parentRadiusM * Math.cbrt(2 * parentDensity / bodyDensity)
}

/** habitable zone inner/outer bounds (simple luminosity model): √(L/1.1) to √(L/0.53) → AU */
export function computeHabitableZoneAu(luminosityW: number): { inner: number, outer: number } {
	const lSolar = luminosityW / SOLAR_LUMINOSITY
	return {
		inner: Math.sqrt(lSolar / 1.1),
		outer: Math.sqrt(lSolar / 0.53),
	}
}

/**
 * Habitable-zone bounds from a star's raw luminosity inputs — explicit
 * luminosity, else Stefan-Boltzmann from radius + temperature. Null if neither
 * luminosity nor radius+temperature is available.
 */
export function deriveHabitableZoneAu(
	luminosityW: number | null,
	radiusM: number | null,
	temperatureK: number | null,
): { inner: number, outer: number } | null {
	const lum = luminosityW != null && luminosityW > 0
		? luminosityW
		: (radiusM != null && temperatureK != null && radiusM > 0 && temperatureK > 0
			? computeLuminosity(radiusM, temperatureK)
			: null)
	return lum != null && lum > 0 ? computeHabitableZoneAu(lum) : null
}

/** periastron = a(1-e) in AU */
export function computePeriastron(semiMajorAxisAu: number, eccentricity: number): number {
	return semiMajorAxisAu * (1 - eccentricity)
}

/** apastron = a(1+e) in AU */
export function computeApastron(semiMajorAxisAu: number, eccentricity: number): number {
	return semiMajorAxisAu * (1 + eccentricity)
}

/** luminosity from radius + temperature via Stefan-Boltzmann: L = 4πR²σT⁴ → W */
export function computeLuminosity(radiusM: number, temperatureK: number): number {
	return 4 * Math.PI * radiusM ** 2 * STEFAN_BOLTZMANN * temperatureK ** 4
}

// ---- System type ----

const SYSTEM_TYPE_BY_COUNT = ['single', 'single', 'binary', 'trinary'] as const

/**
 * Derive the canonical system type from the number of stars in the system.
 * The type is a name for the star count, not an independent fact. A system with
 * no catalogued stars yet reads as 'single'.
 */
export function deriveSystemType(starCount: number): string {
	if (starCount <= 0) return 'single'
	return SYSTEM_TYPE_BY_COUNT[starCount] ?? 'multiple'
}
