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
	Kilograms, Metres, AstronomicalUnits, Days, Seconds, Kelvin, Watts,
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
 * Critical rotation period below which a self-gravitating body spins itself
 * apart. Equatorial centrifugal acceleration ω²R reaches surface gravity GM/r²
 * when ω² = GM/r³ = (4/3)πGρ; substituting ω = 2π/P and cancelling both mass and
 * radius leaves a period set purely by bulk density:
 *   P_crit = 2π / √((4/3)πGρ) = √(3π / Gρ)
 * A body spinning faster than this (a shorter period) cannot hold together by
 * self-gravity alone. Density in kg/m³ → period in seconds. This is why the check
 * is a density equation, not a fixed one-hour rule: a dense body tolerates a far
 * faster spin than a fluffy one.
 */
export function computeRotationalBreakupPeriodS(density: KgPerCubicMetre): Seconds {
	return Math.sqrt((3 * Math.PI) / (G * density)) as Seconds
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

/**
 * Vis-viva instantaneous orbital speed at a given orbital radius:
 *   v = √( μ (2/r − 1/a) )  → m/s
 * The one exact speed law of a two-body orbit. Periapsis (r = a(1−e)) is the
 * fastest point of the orbit, apoapsis (r = a(1+e)) the slowest; a circular
 * orbit (r = a) collapses to the constant √(μ/a). Radius and semi-major axis
 * are both in AU; `mu` is the system's total μ = G(M + m) (see `addMu`).
 */
export function computeOrbitalSpeedAtRadius(mu: GravitationalParameter, radiusAu: AstronomicalUnits, semiMajorAxisAu: AstronomicalUnits): MetresPerSecond {
	const r = radiusAu * AU_M
	const a = semiMajorAxisAu * AU_M
	return Math.sqrt(mu * (2 / r - 1 / a)) as MetresPerSecond
}

/**
 * Circular orbital speed at radius r: v = √(μ/r) → m/s. The speed needed to
 * hold a circular orbit there — equivalently vis-viva with r = a. For an
 * eccentric orbit reach for `computeOrbitalSpeedAtRadius` (a specific point) or
 * `computeMeanOrbitalSpeed` (the time-average) instead.
 */
export function computeCircularOrbitSpeed(mu: GravitationalParameter, radiusAu: AstronomicalUnits): MetresPerSecond {
	const r = radiusAu * AU_M
	return Math.sqrt(mu / r) as MetresPerSecond
}

/**
 * Mean orbital speed — the honest single "how fast does it travel" number:
 * the length of one full orbit divided by its period, i.e. the time-averaged
 * speed. The orbit is an ellipse, so the path length is its perimeter (b =
 * a√(1−e²), via Ramanujan's approximation), *not* 2πa — eccentricity is
 * respected. A circular orbit (e = 0) reduces exactly to the old 2πa/T. Prefer
 * this over any single "orbital velocity" for an eccentric orbit, and reach for
 * `computeOrbitalSpeedAtRadius` when a specific point's speed is wanted.
 */
export function computeMeanOrbitalSpeed(semiMajorAxisAu: AstronomicalUnits, orbitalPeriodDays: Days, eccentricity: number = 0): MetresPerSecond {
	const a = semiMajorAxisAu * AU_M
	const ecc = eccentricity > 0 && eccentricity < 1 ? eccentricity : 0
	const b = a * Math.sqrt(1 - ecc * ecc)
	const h = ((a - b) / (a + b)) ** 2
	const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
	return (perimeter / (orbitalPeriodDays * 86_400)) as MetresPerSecond
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

/**
 * Roche limit — the closest a satellite held together only by its own gravity
 * can orbit before tidal forces shred it:
 *   d = C · R_parent · (ρ_parent / ρ_sat)^(1/3)  → metres
 * The coefficient C depends on how the satellite resists the tide, and the two
 * cases bracket reality rather than agree:
 *   'rigid' → C = 2^(1/3) ≈ 1.26. A solid body that keeps its shape; the tide
 *     must overcome material strength, so it survives closer in. The optimistic
 *     (inner) bound.
 *   'fluid' → C ≈ 2.44. A fluid or loose rubble pile the tide freely elongates
 *     into a football, which then sheds mass from its tips; it gives up first.
 *     The pessimistic (outer) bound.
 * Real moons sit between the two. Defaults to 'rigid' — you MUST pick a case
 * deliberately, because the fluid limit sits ~1.9× farther out than the rigid one.
 */
const ROCHE_COEFFICIENT = { rigid: Math.cbrt(2), fluid: 2.44 } as const
export function computeRocheLimitM(
	parentRadiusM: Metres,
	parentDensity: KgPerCubicMetre,
	bodyDensity: KgPerCubicMetre,
	rigidity: 'rigid' | 'fluid' = 'rigid',
): Metres {
	return (ROCHE_COEFFICIENT[rigidity] * parentRadiusM * Math.cbrt(parentDensity / bodyDensity)) as Metres
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
