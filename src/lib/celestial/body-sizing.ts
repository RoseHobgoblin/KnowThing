export const EARTH_RADIUS_M = 6_371_000
export const SOLAR_RADIUS_M = 695_700_000
export const ASTRONOMICAL_UNIT_M = 149_597_870_700

export type BodySizingInput = {
	radiusM?: number | null
	hasRings?: boolean | null
	bodyType?: string | null
}

function fallbackRadiusM(body: BodySizingInput, isStar: boolean, isSatellite: boolean): number {
	if (isStar) return SOLAR_RADIUS_M
	if (isSatellite) return EARTH_RADIUS_M * 0.27
	const kind = body.bodyType?.toLowerCase() ?? ''
	if (kind.includes('giant') || kind.includes('jovian')) return EARTH_RADIUS_M * 8
	if (kind.includes('dwarf') || kind.includes('asteroid')) return EARTH_RADIUS_M * 0.2
	return EARTH_RADIUS_M
}

/** Physical sphere radius in the same linear AU scene used by the orrery. */
export function physicalBodyRadius(
	body: BodySizingInput,
	isStar: boolean,
	isSatellite: boolean,
	worldUnitsPerAu: number,
): number {
	const radiusM = body.radiusM != null && Number.isFinite(body.radiusM) && body.radiusM > 0
		? body.radiusM
		: fallbackRadiusM(body, isStar, isSatellite)
	return radiusM / ASTRONOMICAL_UNIT_M * worldUnitsPerAu
}

export function physicalBodyExtent(
	body: BodySizingInput,
	isStar: boolean,
	isSatellite: boolean,
	worldUnitsPerAu: number,
): number {
	const radius = physicalBodyRadius(body, isStar, isSatellite, worldUnitsPerAu)
	return body.hasRings ? radius * 1.9 : radius
}

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(maximum, Math.max(minimum, value))

/**
 * A deliberately compressed overview radius in map-world units.
 *
 * Real radii span several orders of magnitude, while orbital distance is also
 * schematic. A low exponent preserves "larger than" without allowing stars or
 * gas giants to consume their neighbouring orbit lanes. The real radius remains
 * on the body model for a future close surface view.
 */
export function overviewBodyRadius(
	body: BodySizingInput,
	isStar: boolean,
	isSatellite: boolean,
): number {
	if (body.radiusM != null && Number.isFinite(body.radiusM) && body.radiusM > 0) {
		if (isStar) {
			return clamp(7 * (body.radiusM / SOLAR_RADIUS_M) ** 0.22, 5.5, 12)
		}
		const reference = 2.8 * (body.radiusM / EARTH_RADIUS_M) ** 0.22
		return isSatellite ? clamp(reference, 1.15, 2.8) : clamp(reference, 1.7, 5.2)
	}
	if (isStar) return 7
	return isSatellite ? 1.5 : 2.8
}

/** Outer solid extent used for orbit-lane and label clearance. */
export function overviewBodyExtent(
	body: BodySizingInput,
	isStar: boolean,
	isSatellite: boolean,
): number {
	const radius = overviewBodyRadius(body, isStar, isSatellite)
	return body.hasRings ? radius * 1.9 : radius
}
