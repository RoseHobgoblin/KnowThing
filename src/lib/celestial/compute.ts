/**
 * Auto-computation of derived celestial properties from numeric inputs.
 * All formulas use SI units (kg, m, s) internally.
 */

const G = 6.674_30e-11 // gravitational constant (m³ kg⁻¹ s⁻²)
const AU_M = 1.495_978_707e11 // 1 AU in metres
const STEFAN_BOLTZMANN = 5.670_374_419e-8 // W m⁻² K⁻⁴
const SOLAR_LUMINOSITY = 3.828e26 // W
const EARTH_MASS_KG = 5.972e24
const JUPITER_MASS_KG = 1.898e27
const SOLAR_MASS_KG = 1.989e30
const EARTH_RADIUS_M = 6.371e6
const JUPITER_RADIUS_M = 6.9911e7
const SOLAR_RADIUS_M = 6.9634e8

/** density = 3M / (4πr³) → kg/m³, displayed as g/cm³ */
export function computeDensity(massKg: number, radiusM: number): number {
	return massKg / ((4 / 3) * Math.PI * radiusM ** 3)
}

/** surface gravity = GM/r² → m/s² */
export function computeSurfaceGravity(massKg: number, radiusM: number): number {
	return (G * massKg) / radiusM ** 2
}

/** escape velocity = √(2GM/r) → m/s, displayed as km/s */
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
 * luminosity, else Stefan-Boltzmann from radius + temperature. Mirrors the
 * luminosity fallback in `deriveStar`, so a lightweight query (just these three
 * columns) can derive the HZ without building a whole star model. Null if
 * neither luminosity nor radius+temperature is available.
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
 * The type is a name for the star count, not an independent fact — deriving it
 * keeps it from drifting out of sync (e.g. "trinary" on a 2-star system).
 * A system with no catalogued stars yet reads as 'single'.
 */
export function deriveSystemType(starCount: number): string {
	if (starCount <= 0) return 'single'
	return SYSTEM_TYPE_BY_COUNT[starCount] ?? 'multiple'
}

// ---- Display formatters ----

/** Format density in g/cm³ */
export function formatDensity(densityKgM3: number): string {
	return `${(densityKgM3 / 1000).toFixed(3)} g/cm³`
}

/** Format surface gravity */
export function formatSurfaceGravity(gravityMs2: number): string {
	return `${gravityMs2.toFixed(gravityMs2 >= 1 ? 2 : 4)} m/s²`
}

/** Format escape velocity in km/s */
export function formatEscapeVelocity(velocityMs: number): string {
	return `${(velocityMs / 1000).toFixed(3)} km/s`
}

/** Format periastron/apastron in AU */
export function formatAu(au: number): string {
	return `${au.toFixed(au >= 1 ? 3 : 6)} AU`
}

/** Format luminosity relative to solar luminosity */
export function formatLuminosity(luminosityW: number): string {
	const solar = luminosityW / SOLAR_LUMINOSITY
	if (solar >= 0.01 && solar <= 10_000) {
		return `${solar.toFixed(solar >= 1 ? 2 : 4)} L☉`
	}
	return `${luminosityW.toExponential(3)} W`
}

/** Format seconds as human-readable period */
export function formatPeriod(seconds: number): string {
	if (seconds < 86_400) {
		const h = Math.floor(seconds / 3600)
		const m = Math.floor((seconds % 3600) / 60)
		const s = Math.round(seconds % 60)
		return `${h}h ${m}m ${s}s`
	}
	const days = seconds / 86_400
	if (days < 365.25) {
		return `${days.toFixed(days >= 10 ? 1 : 3)} days`
	}
	return `${(days / 365.25).toFixed(3)} years`
}

/** Format AU to km */
export function formatAuAsKm(au: number): string {
	const km = au * AU_M / 1000
	if (km >= 1e6) {
		return `${km.toExponential(3)} km`
	}
	return `${km.toLocaleString('en-US', { maximumFractionDigits: 1 })} km`
}

/** Format orbital velocity in km/s */
export function formatOrbitalVelocity(velocityMs: number): string {
	return `${(velocityMs / 1000).toFixed(2)} km/s`
}

/** Format Hill sphere in AU or km depending on size */
export function formatHillSphere(au: number): string {
	if (au >= 0.01) return `${au.toFixed(4)} AU`
	const km = au * AU_M / 1000
	return `${km.toLocaleString('en-US', { maximumFractionDigits: 0 })} km`
}

/** Format Roche limit in km */
export function formatRocheLimit(metres: number): string {
	return `${(metres / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`
}

/** Format mass with reference scale */
export function formatMass(kg: number): string {
	if (kg >= SOLAR_MASS_KG * 0.1) {
		return `${(kg / SOLAR_MASS_KG).toFixed(kg >= SOLAR_MASS_KG * 10 ? 1 : 3)} M☉`
	}
	if (kg >= JUPITER_MASS_KG * 0.1) {
		return `${(kg / JUPITER_MASS_KG).toFixed(kg >= JUPITER_MASS_KG * 10 ? 1 : 3)} Mⱼ`
	}
	if (kg >= EARTH_MASS_KG * 0.01) {
		return `${(kg / EARTH_MASS_KG).toFixed(kg >= EARTH_MASS_KG * 10 ? 1 : 3)} M⊕`
	}
	return `${kg.toExponential(3)} kg`
}

/** Format radius with reference scale */
export function formatRadius(metres: number): string {
	if (metres >= SOLAR_RADIUS_M * 0.1) {
		return `${(metres / SOLAR_RADIUS_M).toFixed(metres >= SOLAR_RADIUS_M * 10 ? 1 : 3)} R☉`
	}
	if (metres >= JUPITER_RADIUS_M * 0.1) {
		return `${(metres / JUPITER_RADIUS_M).toFixed(metres >= JUPITER_RADIUS_M * 10 ? 1 : 3)} Rⱼ`
	}
	if (metres >= EARTH_RADIUS_M * 0.01) {
		return `${(metres / EARTH_RADIUS_M).toFixed(metres >= EARTH_RADIUS_M * 10 ? 1 : 3)} R⊕`
	}
	return `${(metres / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`
}

/** Format temperature in Kelvin */
export function formatTemperatureK(kelvin: number): string {
	return `${kelvin.toLocaleString('en-US', { maximumFractionDigits: 0 })} K`
}

// ---- Composite derivation for save-time ----

export interface BodyDerivedFields {
	density: string | null
	surfaceGravity: string | null
	escapeVelocity: string | null
}

export function deriveBodyFields(massKg: number | null, radiusM: number | null): BodyDerivedFields {
	if (massKg == null || radiusM == null || massKg <= 0 || radiusM <= 0) {
		return { density: null, surfaceGravity: null, escapeVelocity: null }
	}
	return {
		density: formatDensity(computeDensity(massKg, radiusM)),
		surfaceGravity: formatSurfaceGravity(computeSurfaceGravity(massKg, radiusM)),
		escapeVelocity: formatEscapeVelocity(computeEscapeVelocity(massKg, radiusM)),
	}
}

export interface BodyDerivedOrbitalFields {
	orbitalPeriodDays: number | null
	orbitalVelocity: string | null
	hillSphere: string | null
}

export function deriveBodyOrbitalFields(
	semiMajorAxisAu: number | null,
	orbitalPeriodDays: number | null,
	bodyMassKg: number | null,
	parentMassKg: number | null,
	eccentricity: number | null = null,
): BodyDerivedOrbitalFields {
	let period = orbitalPeriodDays

	// Compute orbital period from Kepler's third law if not provided
	if (period == null && semiMajorAxisAu != null && parentMassKg != null && semiMajorAxisAu > 0 && parentMassKg > 0) {
		period = computeOrbitalPeriodDays(semiMajorAxisAu, parentMassKg)
	}

	const orbitalVelocity = semiMajorAxisAu != null && period != null && period > 0
		? formatOrbitalVelocity(computeOrbitalVelocity(semiMajorAxisAu, period))
		: null

	const hillSphere = semiMajorAxisAu != null && bodyMassKg != null && parentMassKg != null
		&& semiMajorAxisAu > 0 && bodyMassKg > 0 && parentMassKg > 0
		? formatHillSphere(computeHillSphereAu(semiMajorAxisAu, bodyMassKg, parentMassKg, eccentricity))
		: null

	return { orbitalPeriodDays: period, orbitalVelocity, hillSphere }
}

export interface StarDerivedOrbitalFields {
	periastron: string | null
	apastron: string | null
}

export function deriveStarOrbitalFields(semiMajorAxisAu: number | null, eccentricity: number | null): StarDerivedOrbitalFields {
	if (semiMajorAxisAu == null || eccentricity == null) {
		return { periastron: null, apastron: null }
	}
	return {
		periastron: formatAu(computePeriastron(semiMajorAxisAu, eccentricity)),
		apastron: formatAu(computeApastron(semiMajorAxisAu, eccentricity)),
	}
}

export interface DisplayStringFields {
	orbitalPeriod: string | null
	semiMajorAxis: string | null
	rotationPeriod: string | null
}

export function deriveDisplayStrings(
	orbitalPeriodDays: number | null,
	semiMajorAxisAu: number | null,
	rotationPeriodS: number | null,
): DisplayStringFields {
	return {
		orbitalPeriod: orbitalPeriodDays != null ? formatPeriod(orbitalPeriodDays * 86_400) : null,
		semiMajorAxis: semiMajorAxisAu != null ? formatAuAsKm(semiMajorAxisAu) : null,
		rotationPeriod: rotationPeriodS != null ? formatPeriod(rotationPeriodS) : null,
	}
}
