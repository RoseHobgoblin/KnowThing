import type { MapBody } from './root-layout.js'

export const SOLAR_LUMINOSITY_W = 3.828e26
export const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8

export type StarlightLuminositySource = 'stored' | 'derived' | 'fallback'

export type StarlightLuminosity = {
	luminosityW: number
	solarLuminosities: number
	source: StarlightLuminositySource
}

function positiveFinite(value: number | null | undefined): value is number {
	return value != null && Number.isFinite(value) && value > 0
}

/**
 * Resolves the luminosity used by the map's display lighting. Stored homework
 * wins; radius plus effective temperature can supply a physical derivation.
 * The final 1 L☉ fallback is deliberately explicit and is not written back.
 */
export function resolveStarlightLuminosity(star: MapBody): StarlightLuminosity {
	if (positiveFinite(star.luminosityW)) {
		return {
			luminosityW: star.luminosityW,
			solarLuminosities: star.luminosityW / SOLAR_LUMINOSITY_W,
			source: 'stored',
		}
	}
	if (positiveFinite(star.radiusM) && positiveFinite(star.temperatureK)) {
		const luminosityW = 4 * Math.PI
			* star.radiusM * star.radiusM
			* STEFAN_BOLTZMANN_W_M2_K4
			* star.temperatureK ** 4
		if (positiveFinite(luminosityW)) {
			return {
				luminosityW,
				solarLuminosities: luminosityW / SOLAR_LUMINOSITY_W,
				source: 'derived',
			}
		}
	}
	return {
		luminosityW: SOLAR_LUMINOSITY_W,
		solarLuminosities: 1,
		source: 'fallback',
	}
}

function formatSolarLuminosity(value: number): string {
	if (value >= 0.01 && value < 10_000) {
		return value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
	}
	return value.toExponential(2).replace('e+', 'e')
}

export function describeStarlightLuminosity(star: MapBody): string {
	const resolved = resolveStarlightLuminosity(star)
	if (resolved.source === 'fallback') {
		return 'Starlight luminosity unavailable—using a 1 L☉ display fallback.'
	}
	const provenance = resolved.source === 'stored'
		? 'stored luminosity'
		: 'derived from radius + temperature'
	return `Starlight · ${formatSolarLuminosity(resolved.solarLuminosities)} L☉ (${provenance})`
}
