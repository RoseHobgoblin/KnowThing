/**
 * Auto-computation of derived celestial properties from numeric inputs.
 * All formulas use SI units (kg, m, s) internally.
 */

const G = 6.674_30e-11 // gravitational constant (m³ kg⁻¹ s⁻²)
const AU_M = 1.495_978_707e11 // 1 AU in metres
const STEFAN_BOLTZMANN = 5.670_374_419e-8 // W m⁻² K⁻⁴
const SOLAR_LUMINOSITY = 3.828e26 // W

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

/** Hill sphere radius: r_H ≈ a × (m / 3M)^(1/3) → AU */
export function computeHillSphereAu(semiMajorAxisAu: number, bodyMassKg: number, parentMassKg: number): number {
	return semiMajorAxisAu * Math.cbrt(bodyMassKg / (3 * parentMassKg))
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
		? formatHillSphere(computeHillSphereAu(semiMajorAxisAu, bodyMassKg, parentMassKg))
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
