/**
 * Physics plausibility checks for celestial bodies.
 * Returns human-readable warnings for suspicious or impossible configurations.
 * These are advisory — the user can override with the lock pattern for intentionally exotic bodies.
 */

export interface PhysicsWarning {
	field: string
	message: string
	severity: 'warning' | 'impossible'
}

// Reference ranges (order-of-magnitude bounds, not hard limits)
const EARTH_MASS = 5.972e24
const JUPITER_MASS = 1.898e27
const SOLAR_MASS = 1.989e30
const EARTH_RADIUS = 6.371e6
const JUPITER_RADIUS = 6.9911e7
const SOLAR_RADIUS = 6.9634e8

export function validateBodyPhysics(params: {
	massKg: number | null
	radiusM: number | null
	orbitalPeriodDays: number | null
	semiMajorAxisAu: number | null
	eccentricity: number | null
	rotationPeriodS: number | null
	axialTilt: number | null
	bodyType: string | null
	isSatellite: boolean
}): PhysicsWarning[] {
	const warnings: PhysicsWarning[] = []
	const { massKg, radiusM, orbitalPeriodDays, semiMajorAxisAu, eccentricity, rotationPeriodS, axialTilt, bodyType, isSatellite } = params

	if (massKg != null && massKg <= 0) {
		warnings.push({ field: 'massKg', message: 'Mass must be positive', severity: 'impossible' })
	}
	if (radiusM != null && radiusM <= 0) {
		warnings.push({ field: 'radiusM', message: 'Radius must be positive', severity: 'impossible' })
	}

	// Density check: if both mass and radius are set
	if (massKg != null && radiusM != null && massKg > 0 && radiusM > 0) {
		const density = massKg / ((4 / 3) * Math.PI * radiusM ** 3)
		const densityGcm3 = density / 1000

		if (densityGcm3 > 25) {
			warnings.push({ field: 'density', message: `Density ${densityGcm3.toFixed(1)} g/cm³ exceeds neutron-degenerate matter. White dwarf matter peaks ~10⁶ g/cm³ — is this intentional?`, severity: 'warning' })
		} else if (densityGcm3 < 0.01 && bodyType === 'planet') {
			warnings.push({ field: 'density', message: `Density ${densityGcm3.toFixed(4)} g/cm³ is lower than any known atmosphere. Even Saturn is 0.687 g/cm³.`, severity: 'warning' })
		}
	}

	// Mass vs body type
	if (massKg != null && bodyType === 'planet') {
		if (massKg > 13 * JUPITER_MASS) {
			warnings.push({ field: 'massKg', message: 'Mass exceeds ~13 Jupiter masses — this is in the brown dwarf range, not a planet', severity: 'warning' })
		}
	}
	if (massKg != null && isSatellite) {
		if (massKg > 0.5 * EARTH_MASS) {
			warnings.push({ field: 'massKg', message: 'Satellite mass exceeds half of Earth — unusually massive for a satellite', severity: 'warning' })
		}
	}

	// Orbital sanity
	if (eccentricity != null) {
		if (eccentricity >= 1) {
			warnings.push({ field: 'eccentricity', message: 'Eccentricity ≥ 1 means an unbound (escape) orbit — not a stable body', severity: 'impossible' })
		} else if (eccentricity > 0.9) {
			warnings.push({ field: 'eccentricity', message: `Eccentricity ${eccentricity} is extremely elliptical — the body's distance from its star varies by ~${((1 + eccentricity) / (1 - eccentricity)).toFixed(0)}×`, severity: 'warning' })
		}
	}

	if (orbitalPeriodDays != null && orbitalPeriodDays <= 0) {
		warnings.push({ field: 'orbitalPeriodDays', message: 'Orbital period must be positive', severity: 'impossible' })
	}

	// Rotation vs orbit: tidally impossible?
	if (rotationPeriodS != null && orbitalPeriodDays != null) {
		const orbitalS = orbitalPeriodDays * 86_400
		// A rotation faster than ~1 hour is likely to tear the body apart
		if (rotationPeriodS < 3600 && massKg != null && massKg > 1e20) {
			warnings.push({ field: 'rotationPeriodS', message: 'Rotation period under 1 hour — centrifugal forces would likely exceed gravity for a body this massive', severity: 'warning' })
		}
	}

	// Axial tilt
	if (axialTilt != null && (axialTilt < 0 || axialTilt > 360)) {
		warnings.push({ field: 'axialTilt', message: 'Axial tilt should be 0–360°', severity: 'warning' })
	}

	return warnings
}

export function validateStarPhysics(params: {
	massKg: number | null
	radiusM: number | null
	semiMajorAxisAu: number | null
	eccentricity: number | null
}): PhysicsWarning[] {
	const warnings: PhysicsWarning[] = []
	const { massKg, radiusM, semiMajorAxisAu, eccentricity } = params

	if (massKg != null && massKg <= 0) {
		warnings.push({ field: 'massKg', message: 'Mass must be positive', severity: 'impossible' })
	}
	if (radiusM != null && radiusM <= 0) {
		warnings.push({ field: 'radiusM', message: 'Radius must be positive', severity: 'impossible' })
	}

	if (massKg != null) {
		if (massKg < 0.08 * SOLAR_MASS && massKg > 13 * JUPITER_MASS) {
			warnings.push({ field: 'massKg', message: 'Mass is in the brown dwarf range (13 Mⱼ – 0.08 M☉) — not a true star', severity: 'warning' })
		}
		if (massKg > 300 * SOLAR_MASS) {
			warnings.push({ field: 'massKg', message: 'Mass exceeds ~300 M☉ — beyond the Eddington limit, such a star would be extremely unstable', severity: 'warning' })
		}
	}

	if (eccentricity != null && eccentricity >= 1) {
		warnings.push({ field: 'eccentricity', message: 'Eccentricity ≥ 1 means an unbound orbit', severity: 'impossible' })
	}

	return warnings
}
