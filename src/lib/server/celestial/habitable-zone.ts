/**
 * Parent-star habitable zone, resolved through the tungolcraft *catalogue* rather
 * than the low-level `deriveHabitableZoneAu` helper.
 *
 * The catalogue evaluators are non-throwing and return a complete, serialisable
 * scientific record — model id, version, source citation/DOI and diagnostics —
 * which is exactly what a value crossing a loader boundary onto a public science
 * page should carry. Where the low-level derive silently returned `null`, the
 * catalogue lets us surface *why* the zone could not be computed and *which*
 * published model produced it when it could.
 */

import { evaluateSimpleHabitableZone, evaluateStefanBoltzmannLuminosity } from 'tungolcraft'

/** The parent star's habitable-zone annulus plus the provenance of the model that produced it. */
export interface ParentStarHz {
	inner: number
	outer: number
	source: {
		modelId: string
		version: string
		title: string
		citation: string
		doi?: string
		url?: string
		/** True when luminosity was derived from radius + temperature (Stefan–Boltzmann) rather than supplied. */
		luminosityDerived: boolean
	}
}

export interface StarHzInputs {
	luminosityW: number | null
	radiusM: number | null
	temperatureK: number | null
}

/**
 * Resolve the habitable zone from whatever the star actually has: an explicit
 * luminosity when present, otherwise Stefan–Boltzmann from radius + temperature.
 * Returns `null` (never throws) when neither path yields a positive luminosity or
 * the zone model rejects its input.
 */
export function resolveParentStarHz(inputs: StarHzInputs): ParentStarHz | null {
	let luminosityW = inputs.luminosityW != null && inputs.luminosityW > 0 ? inputs.luminosityW : null
	let luminosityDerived = false

	// Fall back to the Stefan–Boltzmann catalogue model when no luminosity is stored.
	if (luminosityW == null && inputs.radiusM != null && inputs.temperatureK != null) {
		const luminosity = evaluateStefanBoltzmannLuminosity({
			radiusM: inputs.radiusM,
			temperatureK: inputs.temperatureK,
		})
		if (luminosity.ok) {
			luminosityW = luminosity.output.value
			luminosityDerived = true
		}
	}

	if (luminosityW == null) return null

	const zone = evaluateSimpleHabitableZone({ luminosityW })
	if (!zone.ok) return null

	const primarySource = zone.model.sources[0]
	return {
		inner: zone.output.inner.value,
		outer: zone.output.outer.value,
		source: {
			modelId: zone.model.id,
			version: zone.model.version,
			title: zone.model.title,
			citation: primarySource?.citation ?? zone.model.summary,
			doi: primarySource?.doi,
			url: primarySource?.url,
			luminosityDerived,
		},
	}
}
