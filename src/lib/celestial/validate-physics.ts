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

/** A neighbouring body's orbit, for cross-checking overlapping paths. */
export interface SiblingOrbit {
	name: string
	semiMajorAxisAu: number
	eccentricity: number | null
}

/** Radial [periapsis, apoapsis] band of an orbit; a circular orbit collapses to [a, a]. */
function orbitalBand(semiMajorAxisAu: number, eccentricity: number | null): [number, number] {
	const ecc = eccentricity != null && eccentricity > 0 && eccentricity < 1 ? eccentricity : 0
	return [semiMajorAxisAu * (1 - ecc), semiMajorAxisAu * (1 + ecc)]
}

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
	/** Sibling planets sharing the same star, for orbit-crossing detection. */
	siblingOrbits?: SiblingOrbit[]
	/** Parent body's Hill-sphere radius in AU, for satellite containment. */
	parentHillAu?: number | null
}): PhysicsWarning[] {
	const warnings: PhysicsWarning[] = []
	const { massKg, radiusM, orbitalPeriodDays, semiMajorAxisAu, eccentricity, rotationPeriodS, axialTilt, bodyType, isSatellite } = params
	const siblingOrbits = params.siblingOrbits ?? []
	const parentHillAu = params.parentHillAu ?? null

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

	// Rotational break-up: a rotation faster than ~1 hour would tear a massive body
	// apart. This depends only on spin and mass, not on the orbit, so don't gate it
	// on an orbital period being present (a newly-created body often has none yet).
	if (rotationPeriodS != null && rotationPeriodS < 3600 && massKg != null && massKg > 1e20) {
		warnings.push({ field: 'rotationPeriodS', message: 'Rotation period under 1 hour — centrifugal forces would likely exceed gravity for a body this massive', severity: 'warning' })
	}

	// Axial tilt
	if (axialTilt != null && (axialTilt < 0 || axialTilt > 360)) {
		warnings.push({ field: 'axialTilt', message: 'Axial tilt should be 0–360°', severity: 'warning' })
	}

	// Orbit crossing: does this planet's radial band overlap a sibling's? Crossing
	// paths are dynamically unstable unless the pair is locked in a resonance.
	if (!isSatellite && semiMajorAxisAu != null && semiMajorAxisAu > 0) {
		const [peri, apo] = orbitalBand(semiMajorAxisAu, eccentricity)
		for (const sibling of siblingOrbits) {
			if (sibling.semiMajorAxisAu <= 0) continue
			const [sPeri, sApo] = orbitalBand(sibling.semiMajorAxisAu, sibling.eccentricity)
			if (peri <= sApo && sPeri <= apo) {
				warnings.push({
					field: 'semiMajorAxisAu',
					message: `Orbit overlaps ${sibling.name}'s (their distance ranges cross) — dynamically unstable unless the two are in orbital resonance`,
					severity: 'warning',
				})
			}
		}
	}

	// Satellite containment: a moon orbiting beyond its parent's Hill sphere is not
	// gravitationally bound to the parent and would be stripped away by the star.
	if (isSatellite && semiMajorAxisAu != null && semiMajorAxisAu > 0 && parentHillAu != null && parentHillAu > 0 && semiMajorAxisAu > parentHillAu) {
		warnings.push({
			field: 'semiMajorAxisAu',
			message: `Orbit (${semiMajorAxisAu.toFixed(4)} AU from its parent) lies beyond the parent's Hill sphere (~${parentHillAu.toFixed(4)} AU) — it would not stay bound`,
			severity: 'warning',
		})
	}

	return warnings
}

// Main-sequence Morgan–Keenan temperature bands (K). Bounds are approximate — a
// star just outside a band is a hint, not an error.
const SPECTRAL_TEMP_RANGES: Record<string, [number, number]> = {
	O: [30_000, 60_000],
	B: [10_000, 30_000],
	A: [7500, 10_000],
	F: [6000, 7500],
	G: [5200, 6000],
	K: [3700, 5200],
	M: [2400, 3700],
}

export function validateStarPhysics(params: {
	massKg: number | null
	radiusM: number | null
	semiMajorAxisAu: number | null
	eccentricity: number | null
	temperatureK?: number | null
	spectralType?: string | null
}): PhysicsWarning[] {
	const warnings: PhysicsWarning[] = []
	const { massKg, radiusM, semiMajorAxisAu, eccentricity, temperatureK, spectralType } = params

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

	// Temperature vs spectral class: the leading MK letter names a temperature band.
	// Flag a temperature that contradicts the class (a "cool O-star", etc.).
	if (temperatureK != null && temperatureK > 0 && spectralType) {
		const letter = spectralType.trim().charAt(0).toUpperCase()
		const range = SPECTRAL_TEMP_RANGES[letter]
		if (range) {
			const [min, max] = range
			// 10% slack so a star right at a boundary doesn't nag.
			if (temperatureK < min * 0.9 || temperatureK > max * 1.1) {
				warnings.push({
					field: 'temperatureK',
					message: `Temperature ${Math.round(temperatureK).toLocaleString('en-US')} K contradicts spectral class ${letter} (${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')} K)`,
					severity: 'warning',
				})
			}
		}
	}

	return warnings
}
