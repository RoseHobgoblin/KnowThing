/**
 * Physics plausibility checks — the consistency engine. Given a body's or star's
 * numbers, return human-readable warnings for suspicious or impossible
 * configurations (a moon beyond its Hill sphere, a cool O-star, crossing
 * orbits). Advisory, not enforced: a worldbuilder can knowingly build the exotic.
 */

import {
	computeDensity,
	computeParentBarycenterDistanceM,
	computeRotationalBreakupPeriodS,
	estimateSatelliteStabilityLimitAu,
	type SatelliteOrbitSense,
} from './physics.js'
import { au, kg, m } from './units.js'

export interface PhysicsWarning {
	field: string
	message: string
	severity: 'warning' | 'impossible'
}

// Reference ranges (order-of-magnitude bounds, not hard limits)
const JUPITER_MASS = 1.898e27
const SOLAR_MASS = 1.989e30

/**
 * Default screening envelope for planet/small-body bulk density (g/cm³).
 * These are intentionally product-level review thresholds, not fundamental
 * material limits. Pressure, composition and object class require dedicated
 * equations of state; callers modelling those regimes should disable or replace
 * this advisory layer.
 */
const DEFAULT_PLANETARY_DENSITY_HIGH_GCM3 = 25
const DEFAULT_PLANETARY_DENSITY_LOW_GCM3 = 0.01

/** A neighbouring body's orbit, for cross-checking overlapping paths. */
export interface SiblingOrbit {
	name: string
	semiMajorAxisAu: number
	eccentricity: number | null
}

/** Radial [periapsis, apoapsis] band of an orbit; a circular orbit collapses to [a, a]. */
function orbitalBand(semiMajorAxisAu: number, eccentricity: number | null): [number, number] | null {
	if (eccentricity != null && (eccentricity < 0 || eccentricity >= 1 || !Number.isFinite(eccentricity))) return null
	const ecc = eccentricity ?? 0
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
	/** Parent body's mass in kg, for the satellite-to-parent mass-ratio check. */
	parentMassKg?: number | null
	/** Parent body's mean radius in metres, for locating the pair's barycenter. */
	parentRadiusM?: number | null
	/** Eccentricity of the parent's orbit around its own primary. */
	parentOrbitEccentricity?: number | null
	/**
	 * A satellite's orbit sense sets how much of the Hill radius stays stable
	 * (retrograde moons hold on farther out). Defaults to 'prograde'.
	 */
	satelliteOrbitSense?: SatelliteOrbitSense
	/**
	 * Expert override of the outer stability boundary as a fraction of the
	 * conventional Hill radius. Otherwise Domingos et al. (2006) is used.
	 */
	hillStableFraction?: number | null
}): PhysicsWarning[] {
	const warnings: PhysicsWarning[] = []
	const { massKg, radiusM, orbitalPeriodDays, semiMajorAxisAu, eccentricity, rotationPeriodS, axialTilt, bodyType, isSatellite } = params
	const siblingOrbits = params.siblingOrbits ?? []
	const parentHillAu = params.parentHillAu ?? null
	const parentMassKg = params.parentMassKg ?? null
	const parentRadiusM = params.parentRadiusM ?? null
	const parentOrbitEccentricity = params.parentOrbitEccentricity ?? null

	if (massKg != null && massKg <= 0) {
		warnings.push({ field: 'massKg', message: 'Mass must be positive', severity: 'impossible' })
	}
	if (radiusM != null && radiusM <= 0) {
		warnings.push({ field: 'radiusM', message: 'Radius must be positive', severity: 'impossible' })
	}

	// Default planet/small-body screening only. These bounds are deliberately not
	// described as universal material limits: compression and object class require
	// an equation-of-state model that this advisory layer does not yet provide.
	if (massKg != null && radiusM != null && massKg > 0 && radiusM > 0) {
		const densityGcm3 = computeDensity(kg(massKg), m(radiusM)) / 1000

		if (densityGcm3 > DEFAULT_PLANETARY_DENSITY_HIGH_GCM3) {
			warnings.push({ field: 'density', message: `Density ${densityGcm3.toFixed(1)} g/cm³ lies above Tungolcraft's default planetary/small-body screening envelope. A compressed or exotic body needs a class-specific equation-of-state model; otherwise check mass and radius.`, severity: 'warning' })
		} else if (densityGcm3 < DEFAULT_PLANETARY_DENSITY_LOW_GCM3) {
			warnings.push({ field: 'density', message: `Density ${densityGcm3.toFixed(4)} g/cm³ lies below Tungolcraft's default planetary/small-body screening envelope. A diffuse structure needs a class-specific model; otherwise check mass and radius.`, severity: 'warning' })
		}
	}

	// Mass vs body type
	if (massKg != null && bodyType === 'planet' && massKg > 13 * JUPITER_MASS) {
		warnings.push({ field: 'massKg', message: 'Mass exceeds ~13 Jupiter masses — this is in the brown dwarf range, not a planet', severity: 'warning' })
	}
	// Binary/double-body geometry: mass ratio alone cannot tell whether the
	// barycenter is outside the parent. Compute its actual parent-centred distance
	// from separation and both masses, then compare it with the parent's radius.
	if (isSatellite && massKg != null && massKg > 0
		&& parentMassKg != null && parentMassKg > 0
		&& parentRadiusM != null && parentRadiusM > 0
		&& semiMajorAxisAu != null && semiMajorAxisAu > 0) {
		const barycenterM = computeParentBarycenterDistanceM(
			au(semiMajorAxisAu),
			kg(parentMassKg),
			kg(massKg),
		)
		if (barycenterM > parentRadiusM) {
			warnings.push({
				field: 'massKg',
				message: `The pair's barycenter lies ${(barycenterM / 1000).toFixed(0)} km from the parent's centre, outside its ${(parentRadiusM / 1000).toFixed(0)} km radius — this is dynamically a double/binary body rather than a primary-centred moon`,
				severity: 'warning',
			})
		}
	}

	// Orbital sanity
	if (eccentricity != null) {
		if (!Number.isFinite(eccentricity) || eccentricity < 0) {
			warnings.push({ field: 'eccentricity', message: 'Bound-orbit eccentricity must be a finite value in [0, 1)', severity: 'impossible' })
		} else if (eccentricity >= 1) {
			warnings.push({ field: 'eccentricity', message: 'Eccentricity ≥ 1 is outside the bound elliptical-orbit model', severity: 'impossible' })
		} else if (eccentricity > 0.9) {
			warnings.push({ field: 'eccentricity', message: `Eccentricity ${eccentricity} is extremely elliptical — the body's distance from its star varies by ~${((1 + eccentricity) / (1 - eccentricity)).toFixed(0)}×`, severity: 'warning' })
		}
	}

	if (orbitalPeriodDays != null && orbitalPeriodDays <= 0) {
		warnings.push({ field: 'orbitalPeriodDays', message: 'Orbital period must be positive', severity: 'impossible' })
	}

	// Rotational break-up: below the critical spin period P_crit = √(3π/Gρ) a body
	// cannot hold together by self-gravity. This is a density equation, not a fixed
	// one-hour rule — a dense body tolerates a much faster spin than a fluffy one —
	// so it needs both mass and radius. It doesn't depend on the orbit, so a
	// newly-created body with no period yet is still checked.
	if (rotationPeriodS != null && rotationPeriodS > 0 && massKg != null && radiusM != null && massKg > 0 && radiusM > 0) {
		const density = computeDensity(kg(massKg), m(radiusM))
		const breakupS = computeRotationalBreakupPeriodS(density)
		if (rotationPeriodS < breakupS) {
			warnings.push({
				field: 'rotationPeriodS',
				message: `Rotation period ${(rotationPeriodS / 3600).toFixed(2)} h is below the ${(breakupS / 3600).toFixed(2)} h break-up period for this body's density (${(density / 1000).toFixed(2)} g/cm³) — equatorial centrifugal force would exceed self-gravity`,
				severity: 'warning',
			})
		}
	}

	// Axial tilt = obliquity: the angle between the spin axis and the orbital-plane
	// normal (equivalently, the tilt of the equatorial plane relative to the orbital
	// plane). 0° = upright, 90° = spinning on its side, 180° = fully retrograde. It
	// is physically defined on [0°, 180°]; 180–360° names the same tilt viewed from
	// the opposite node, so flag it as non-canonical rather than impossible.
	if (axialTilt != null && (axialTilt < 0 || axialTilt > 180)) {
		warnings.push({
			field: 'axialTilt',
			message: `Axial tilt ${axialTilt}° falls outside the 0–180° obliquity convention (measured from the orbital-plane normal); 180–360° describes the same physical tilt seen from the opposite node`,
			severity: 'warning',
		})
	}

	// Orbit crossing: does this planet's radial [periapsis, apoapsis] band overlap a
	// sibling's? A geometric intersection of the two bands is only a *flag* — whether
	// the orbits actually destabilise turns on resonance, relative inclination and
	// orbital phase, none of which a radial-range test can see. So report the
	// crossing, not a verdict of instability.
	if (!isSatellite && semiMajorAxisAu != null && semiMajorAxisAu > 0) {
		const band = orbitalBand(semiMajorAxisAu, eccentricity)
		if (band) {
			const [peri, apo] = band
			for (const sibling of siblingOrbits) {
				if (sibling.semiMajorAxisAu <= 0) continue
				const siblingBand = orbitalBand(sibling.semiMajorAxisAu, sibling.eccentricity)
				if (!siblingBand) continue
				const [sPeri, sApo] = siblingBand
				if (peri <= sApo && sPeri <= apo) {
					warnings.push({
						field: 'semiMajorAxisAu',
						message: `Orbit's radial band [${peri.toFixed(2)}–${apo.toFixed(2)} AU] overlaps ${sibling.name}'s [${sPeri.toFixed(2)}–${sApo.toFixed(2)} AU] — the paths cross in radius. This is a geometric flag; whether it destabilises depends on resonance, inclination and phase.`,
						severity: 'warning',
					})
				}
			}
		}
	}

	// Satellite containment. `parentHillAu` is evaluated at the parent's
	// periapsis; convert it back to the conventional semi-major-axis Hill radius
	// before applying the eccentricity-dependent Domingos et al. (2006) fit.
	if (isSatellite && semiMajorAxisAu != null && semiMajorAxisAu > 0 && parentHillAu != null && parentHillAu > 0) {
		const sense = params.satelliteOrbitSense ?? 'prograde'
		const parentEcc = parentOrbitEccentricity ?? 0
		const conventionalHillAu = parentEcc >= 0 && parentEcc < 1 ? parentHillAu / (1 - parentEcc) : parentHillAu
		if (!Number.isFinite(parentEcc) || parentEcc < 0 || parentEcc >= 1) {
			warnings.push({
				field: 'parentOrbitEccentricity',
				message: 'Cannot estimate satellite stability: parent orbital eccentricity must be in [0, 1)',
				severity: 'impossible',
			})
			return warnings
		}
		if (params.hillStableFraction != null
			&& (!Number.isFinite(params.hillStableFraction) || params.hillStableFraction <= 0)) {
			warnings.push({
				field: 'hillStableFraction',
				message: 'Custom Hill stability fraction must be a finite positive value',
				severity: 'impossible',
			})
			return warnings
		}
		let estimate: { limitAu: number, hillFraction: number, model: 'domingos-2006' | 'custom' }
		try {
			estimate = params.hillStableFraction == null
				? estimateSatelliteStabilityLimitAu(au(conventionalHillAu), parentEcc, eccentricity, sense)
				: {
					limitAu: conventionalHillAu * params.hillStableFraction,
					hillFraction: params.hillStableFraction,
					model: 'custom',
				}
		} catch (error) {
			warnings.push({
				field: 'eccentricity',
				message: `Cannot estimate satellite stability within the Domingos 2006 model: ${error instanceof Error ? error.message : 'inputs are outside its domain'}`,
				severity: 'warning',
			})
			return warnings
		}
		const stableAu = estimate.limitAu
		if (semiMajorAxisAu > parentHillAu) {
			warnings.push({
				field: 'semiMajorAxisAu',
				message: `Orbit (${semiMajorAxisAu.toFixed(4)} AU from its parent) lies beyond the parent's Hill sphere (~${parentHillAu.toFixed(4)} AU) — it is not bound to the parent and would be stripped away`,
				severity: 'warning',
			})
		} else if (semiMajorAxisAu > stableAu) {
			warnings.push({
				field: 'semiMajorAxisAu',
				message: `Orbit (${semiMajorAxisAu.toFixed(4)} AU) exceeds the ${stableAu.toFixed(4)} AU empirical outer-stability estimate for a ${sense} satellite (${estimate.model}, ${estimate.hillFraction.toFixed(3)}× the conventional Hill radius). This restricted-three-body estimate is a screening result, not an N-body guarantee.`,
				severity: 'warning',
			})
		}
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
