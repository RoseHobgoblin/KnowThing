/**
 * Human-readable formatters — the display layer over the pure SI numbers from
 * `physics`. Separated so the numeric core stays unit-agnostic and tree-shakes
 * cleanly; import from `tungolcraft` only if you want the strings.
 */

import {
	AU_M, SOLAR_LUMINOSITY,
	EARTH_MASS_KG, JUPITER_MASS_KG, SOLAR_MASS_KG,
	EARTH_RADIUS_M, JUPITER_RADIUS_M, SOLAR_RADIUS_M,
} from './constants.js'

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
