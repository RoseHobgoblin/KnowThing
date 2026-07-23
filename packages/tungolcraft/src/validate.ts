/**
 * Physics plausibility checks — the consistency engine. Given a body's or star's
 * numbers, return human-readable warnings for suspicious or impossible
 * configurations (a moon beyond its Hill sphere, a cool O-star, crossing
 * orbits). Advisory, not enforced: a worldbuilder can knowingly build the exotic.
 */

import { computeDensity, computeRotationalBreakupPeriodS } from './physics.js'
import { kg, m } from './units.js'

export interface PhysicsWarning {
	field: string
	message: string
	severity: 'warning' | 'impossible'
}

// Reference ranges (order-of-magnitude bounds, not hard limits)
const JUPITER_MASS = 1.898e27
const SOLAR_MASS = 1.989e30

/**
 * Regime-agnostic density outlier bounds (g/cm³). Deliberately NOT tied to a
 * physical regime — real density plausibility depends on object class and
 * equation of state (rocky/iron planet, gas giant, brown dwarf, white dwarf,
 * neutron star), which are a future per-class modelling job. These just bracket
 * what any ordinary, non-degenerate matter can be: above the densest solid
 * element (osmium ~22.6) or below the least dense known body (Saturn 0.687).
 */
const DENSITY_OUTLIER_HIGH_GCM3 = 25
const DENSITY_OUTLIER_LOW_GCM3 = 0.01

/**
 * Satellite-to-parent mass ratio above which a body is better described as a
 * double/binary system than a moon: the barycenter then sits well outside the
 * primary and both bodies visibly swing around it. Pluto–Charon (≈ 0.12) is the
 * canonical borderline case, so ~0.1 is a sensible nag threshold.
 */
const SATELLITE_MASS_RATIO_MAX = 0.1

/**
 * Long-term-stable satellite orbit as a fraction of the parent's Hill radius.
 * Prograde moons survive to roughly half the Hill radius; retrograde moons,
 * being more resistant to solar perturbations, hold on out to ~0.7. Beyond the
 * full Hill radius nothing stays bound at all. (Configurable per call.)
 */
const HILL_STABLE_FRACTION = { prograde: 0.5, retrograde: 0.7 } as const

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
	/** Parent body's mass in kg, for the satellite-to-parent mass-ratio check. */
	parentMassKg?: number | null
	/**
	 * A satellite's orbit sense sets how much of the Hill radius stays stable
	 * (retrograde moons hold on farther out). Defaults to 'prograde'.
	 */
	satelliteOrbitSense?: 'prograde' | 'retrograde'
	/** Override the stable-orbit Hill fraction directly (else set by orbit sense). */
	hillStableFraction?: number | null
}): PhysicsWarning[] {
	const warnings: PhysicsWarning[] = []
	const { massKg, radiusM, orbitalPeriodDays, semiMajorAxisAu, eccentricity, rotationPeriodS, axialTilt, bodyType, isSatellite } = params
	const siblingOrbits = params.siblingOrbits ?? []
	const parentHillAu = params.parentHillAu ?? null
	const parentMassKg = params.parentMassKg ?? null

	if (massKg != null && massKg <= 0) {
		warnings.push({ field: 'massKg', message: 'Mass must be positive', severity: 'impossible' })
	}
	if (radiusM != null && radiusM <= 0) {
		warnings.push({ field: 'radiusM', message: 'Radius must be positive', severity: 'impossible' })
	}

	// Density plausibility. Judging density *properly* needs the object's class and
	// equation of state — a rocky/iron planet, a gas giant and a stellar remnant obey
	// entirely different mass–radius relations — and those class-specific envelopes
	// are not modelled here yet. Until they are, flag only regime-agnostic outliers
	// (a density no ordinary, non-degenerate matter can produce) and name no physical
	// regime: the old message wrongly claimed 25 g/cm³ "exceeds neutron-degenerate
	// matter", which actually sits near 10¹⁴ g/cm³, then contradicted itself with a
	// 10⁶ g/cm³ white-dwarf figure. See DENSITY_OUTLIER_* for the bounds.
	if (massKg != null && radiusM != null && massKg > 0 && radiusM > 0) {
		const densityGcm3 = computeDensity(kg(massKg), m(radiusM)) / 1000

		if (densityGcm3 > DENSITY_OUTLIER_HIGH_GCM3) {
			warnings.push({ field: 'density', message: `Density ${densityGcm3.toFixed(1)} g/cm³ is a physical outlier — denser than the densest ordinary solid (osmium, ~22.6 g/cm³). Intentional?`, severity: 'warning' })
		} else if (densityGcm3 < DENSITY_OUTLIER_LOW_GCM3) {
			warnings.push({ field: 'density', message: `Density ${densityGcm3.toFixed(4)} g/cm³ is a physical outlier — less dense than any known body (Saturn, the least dense planet, is 0.687 g/cm³). Intentional?`, severity: 'warning' })
		}
	}

	// Mass vs body type
	if (massKg != null && bodyType === 'planet' && massKg > 13 * JUPITER_MASS) {
		warnings.push({ field: 'massKg', message: 'Mass exceeds ~13 Jupiter masses — this is in the brown dwarf range, not a planet', severity: 'warning' })
	}
	// Satellite plausibility by mass ratio, not an absolute mass: a body far
	// lighter than its parent is an ordinary moon; as m_sat/M_parent climbs the
	// two are better described as a double/binary orbiting a shared barycenter.
	if (isSatellite && massKg != null && massKg > 0 && parentMassKg != null && parentMassKg > 0) {
		const ratio = massKg / parentMassKg
		if (ratio > SATELLITE_MASS_RATIO_MAX) {
			warnings.push({
				field: 'massKg',
				message: `Satellite-to-parent mass ratio ${ratio.toFixed(3)} exceeds ~${SATELLITE_MASS_RATIO_MAX} — the pair reads more as a double/binary body (barycenter outside the parent) than a moon`,
				severity: 'warning',
			})
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
		const [peri, apo] = orbitalBand(semiMajorAxisAu, eccentricity)
		for (const sibling of siblingOrbits) {
			if (sibling.semiMajorAxisAu <= 0) continue
			const [sPeri, sApo] = orbitalBand(sibling.semiMajorAxisAu, sibling.eccentricity)
			if (peri <= sApo && sPeri <= apo) {
				warnings.push({
					field: 'semiMajorAxisAu',
					message: `Orbit's radial band [${peri.toFixed(2)}–${apo.toFixed(2)} AU] overlaps ${sibling.name}'s [${sPeri.toFixed(2)}–${sApo.toFixed(2)} AU] — the paths cross in radius. This is a geometric flag; whether it destabilises depends on resonance, inclination and phase.`,
					severity: 'warning',
				})
			}
		}
	}

	// Satellite containment: a moon's orbit is only stable out to a fraction of the
	// parent's Hill radius (~0.5 prograde, ~0.7 retrograde), not the full radius —
	// solar perturbations strip it well before the formal boundary. Beyond the full
	// Hill radius it is not bound to the parent at all.
	if (isSatellite && semiMajorAxisAu != null && semiMajorAxisAu > 0 && parentHillAu != null && parentHillAu > 0) {
		const sense = params.satelliteOrbitSense ?? 'prograde'
		const fraction = params.hillStableFraction ?? HILL_STABLE_FRACTION[sense]
		const stableAu = parentHillAu * fraction
		if (semiMajorAxisAu > parentHillAu) {
			warnings.push({
				field: 'semiMajorAxisAu',
				message: `Orbit (${semiMajorAxisAu.toFixed(4)} AU from its parent) lies beyond the parent's Hill sphere (~${parentHillAu.toFixed(4)} AU) — it is not bound to the parent and would be stripped away`,
				severity: 'warning',
			})
		} else if (semiMajorAxisAu > stableAu) {
			warnings.push({
				field: 'semiMajorAxisAu',
				message: `Orbit (${semiMajorAxisAu.toFixed(4)} AU) exceeds ~${fraction.toFixed(2)}× the parent's Hill radius (~${stableAu.toFixed(4)} of ${parentHillAu.toFixed(4)} AU), the long-term-stable limit for a ${sense} satellite — likely unstable over many orbits`,
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
