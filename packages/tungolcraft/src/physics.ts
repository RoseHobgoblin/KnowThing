/**
 * Closed-form astrophysical formulas. Pure functions with branded SI units in
 * and out (see `units`): given a body's raw quantities (mass, radius, semi-major
 * axis, …), derive the rest — density, gravity, escape velocity, orbital
 * mechanics, Roche/Hill limits, habitable zone, luminosity. The compiler rejects
 * a wrong-unit argument; wrap raw numbers at the boundary with `kg`, `m`, `au`, …
 */

import { G, AU_M, STEFAN_BOLTZMANN, SOLAR_LUMINOSITY } from './constants.js'
import { m, kelvin, watts } from './units.js'
import type {
	Kilograms, Metres, AstronomicalUnits, Days, Kelvin, Watts,
	MetresPerSecond, MetresPerSecondSquared, KgPerCubicMetre, GravitationalParameter,
} from './units.js'

/** density = 3M / (4πr³) → kg/m³ */
export function computeDensity(massKg: Kilograms, radiusM: Metres): KgPerCubicMetre {
	return (massKg / ((4 / 3) * Math.PI * radiusM ** 3)) as KgPerCubicMetre
}

/** surface gravity = GM/r² → m/s² */
export function computeSurfaceGravity(massKg: Kilograms, radiusM: Metres): MetresPerSecondSquared {
	return ((G * massKg) / radiusM ** 2) as MetresPerSecondSquared
}

/** escape velocity = √(2GM/r) → m/s */
export function computeEscapeVelocity(massKg: Kilograms, radiusM: Metres): MetresPerSecond {
	return Math.sqrt((2 * G * massKg) / radiusM) as MetresPerSecond
}

/**
 * Orbital period via Kepler's third law in its exact two-body form:
 *   T = 2π √(a³ / μ),   μ = G(M + m)
 *
 * `mu` is the system's *total* standard gravitational parameter — the summed μ of
 * both partners (see `addMu` / `muFromMass`), not the primary's alone. For M ≫ m
 * the secondary term is negligible; for comparable masses (binaries) it is not,
 * which is why the parameter is μ_total rather than a single mass. Working in
 * μ = GM also sidesteps the G-vs-mass precision mismatch the IAU nominal
 * constants exist to prevent (Resolution B3, 2015).
 */
export function computeOrbitalPeriodDays(semiMajorAxisAu: AstronomicalUnits, mu: GravitationalParameter): Days {
	const a = semiMajorAxisAu * AU_M
	const secs = 2 * Math.PI * Math.sqrt(a ** 3 / mu)
	return (secs / 86_400) as Days
}

/** mean orbital velocity: v = 2πa / T → m/s */
export function computeOrbitalVelocity(semiMajorAxisAu: AstronomicalUnits, orbitalPeriodDays: Days): MetresPerSecond {
	const a = semiMajorAxisAu * AU_M
	return ((2 * Math.PI * a) / (orbitalPeriodDays * 86_400)) as MetresPerSecond
}

/**
 * Hill sphere radius: r_H ≈ a(1 − e) × (m / 3M)^(1/3) → AU.
 * The (1 − e) periapsis factor matters for eccentric orbits — the sphere is
 * smallest (and containment tightest) at closest approach. A null or
 * out-of-range eccentricity is treated as a circular orbit.
 */
export function computeHillSphereAu(semiMajorAxisAu: AstronomicalUnits, bodyMassKg: Kilograms, parentMassKg: Kilograms, eccentricity: number | null = null): AstronomicalUnits {
	const ecc = eccentricity != null && eccentricity > 0 && eccentricity < 1 ? eccentricity : 0
	return (semiMajorAxisAu * (1 - ecc) * Math.cbrt(bodyMassKg / (3 * parentMassKg))) as AstronomicalUnits
}

/** Roche limit (rigid body): d ≈ R_parent × (2 × ρ_parent / ρ_sat)^(1/3) → metres */
export function computeRocheLimitM(parentRadiusM: Metres, parentDensity: KgPerCubicMetre, bodyDensity: KgPerCubicMetre): Metres {
	return (parentRadiusM * Math.cbrt(2 * parentDensity / bodyDensity)) as Metres
}

/** habitable zone inner/outer bounds (simple luminosity model): √(L/1.1) to √(L/0.53) → AU */
export function computeHabitableZoneAu(luminosityW: Watts): { inner: AstronomicalUnits, outer: AstronomicalUnits } {
	const lSolar = luminosityW / SOLAR_LUMINOSITY
	return {
		inner: Math.sqrt(lSolar / 1.1) as AstronomicalUnits,
		outer: Math.sqrt(lSolar / 0.53) as AstronomicalUnits,
	}
}

/**
 * Habitable-zone bounds from a star's raw luminosity inputs — explicit
 * luminosity, else Stefan-Boltzmann from radius + temperature. A loose-number
 * convenience edge (nullable plain numbers in); brands internally. Null if
 * neither luminosity nor radius+temperature is available.
 */
export function deriveHabitableZoneAu(
	luminosityW: number | null,
	radiusM: number | null,
	temperatureK: number | null,
): { inner: AstronomicalUnits, outer: AstronomicalUnits } | null {
	const lum = luminosityW != null && luminosityW > 0
		? luminosityW
		: (radiusM != null && temperatureK != null && radiusM > 0 && temperatureK > 0
			? computeLuminosity(m(radiusM), kelvin(temperatureK))
			: null)
	return lum != null && lum > 0 ? computeHabitableZoneAu(watts(lum)) : null
}

/** periastron = a(1-e) in AU */
export function computePeriastron(semiMajorAxisAu: AstronomicalUnits, eccentricity: number): AstronomicalUnits {
	return (semiMajorAxisAu * (1 - eccentricity)) as AstronomicalUnits
}

/** apastron = a(1+e) in AU */
export function computeApastron(semiMajorAxisAu: AstronomicalUnits, eccentricity: number): AstronomicalUnits {
	return (semiMajorAxisAu * (1 + eccentricity)) as AstronomicalUnits
}

/** luminosity from radius + temperature via Stefan-Boltzmann: L = 4πR²σT⁴ → W */
export function computeLuminosity(radiusM: Metres, temperatureK: Kelvin): Watts {
	return (4 * Math.PI * radiusM ** 2 * STEFAN_BOLTZMANN * temperatureK ** 4) as Watts
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
