/**
 * Read-time effective orbital periods for a system's stars and bodies.
 *
 * A blank `orbitalPeriodDays` means "derive it". These helpers fill the gap from
 * Kepler's third law using the mass of whatever each row actually orbits:
 *
 *  - a companion star orbiting another star  → combined pair mass
 *  - a star orbiting the system barycenter   → total stellar mass of the system
 *  - a body orbiting a star                  → that star's mass
 *  - a moon orbiting a body                  → that body's mass
 *  - a circumbinary body orbiting the system → total stellar mass of the system
 *
 * Pure: callers pass the already-loaded rows for one system and get the same
 * rows back with periods filled in.
 */
import { computeOrbitalPeriodDays } from './physics.js'
import { au, kg, addMu, muFromMass, type GravitationalParameter } from './units.js'

export interface EffectiveOrbitStar {
	id: number
	massKg?: number | null
	semiMajorAxisAu?: number | null
	orbitalPeriodDays?: number | null
	/** Direct parent when the parent is a star (companion pair). */
	parentStarId?: number | null
	/** Direct parent when the parent is the system (barycentric orbit). */
	parentSystemId?: number | null
}

export interface EffectiveOrbitBody {
	id: number
	massKg?: number | null
	semiMajorAxisAu?: number | null
	orbitalPeriodDays?: number | null
	/** Nearest star ancestor (the primary for a planet and its moons). */
	starId?: number | null
	/** Direct parent when the parent is a body (moon). */
	parentId?: number | null
	/** Direct parent when the parent is the system (circumbinary). */
	parentSystemId?: number | null
}

const positiveMass = (massKg: number | null | undefined): number | null =>
	(massKg != null && massKg > 0 ? massKg : null)

/** Combined mass of a system's stars — the barycenter's effective mass. */
export function totalStellarMassKg(stars: ReadonlyArray<{ massKg?: number | null }>): number | null {
	let total = 0
	for (const star of stars) total += positiveMass(star.massKg) ?? 0
	return total > 0 ? total : null
}

/** μ = GM from a possibly-missing mass; a null/zero mass contributes nothing. */
function muOf(massKg: number | null | undefined): GravitationalParameter {
	return muFromMass(kg(positiveMass(massKg) ?? 0))
}

function derivedPeriod(semiMajorAxisAu: number | null | undefined, mu: GravitationalParameter | null): number | null {
	return semiMajorAxisAu != null && semiMajorAxisAu > 0 && mu != null
		? computeOrbitalPeriodDays(au(semiMajorAxisAu), mu)
		: null
}

/**
 * Fill in missing `orbitalPeriodDays` across one system's rows. Stored values
 * (user assertions) always win; rows without enough data are left untouched.
 */
export function annotateEffectivePeriods<S extends EffectiveOrbitStar, B extends EffectiveOrbitBody>(
	stars: S[],
	bodies: B[],
): { stars: S[], bodies: B[] } {
	const barycenterMassKg = totalStellarMassKg(stars)
	const starById = new Map(stars.map(star => [star.id, star]))
	const bodyById = new Map(bodies.map(body => [body.id, body]))

	const annotatedStars = stars.map((star) => {
		if (star.orbitalPeriodDays != null) return star
		// A companion pair orbits with the combined μ of both partners; a
		// barycentric component orbits with the whole system's stellar μ (which
		// already includes this star, so it is not added again).
		let mu: GravitationalParameter | null = null
		if (star.parentStarId != null) {
			const partnerMassKg = positiveMass(starById.get(star.parentStarId)?.massKg)
			mu = partnerMassKg == null ? null : addMu(muOf(partnerMassKg), muOf(star.massKg))
		} else if (star.parentSystemId != null) {
			mu = barycenterMassKg == null ? null : muOf(barycenterMassKg)
		}
		const period = derivedPeriod(star.semiMajorAxisAu, mu)
		return period == null ? star : { ...star, orbitalPeriodDays: period }
	})

	const annotatedBodies = bodies.map((body) => {
		if (body.orbitalPeriodDays != null) return body
		// Two-body μ: the central mass (parent body, star, or system barycenter)
		// plus this body's own μ. None of those central masses already include it.
		let mu: GravitationalParameter | null = null
		if (body.parentId != null) {
			const parentMassKg = positiveMass(bodyById.get(body.parentId)?.massKg)
			mu = parentMassKg == null ? null : addMu(muOf(parentMassKg), muOf(body.massKg))
		} else if (body.starId != null) {
			const starMassKg = positiveMass(starById.get(body.starId)?.massKg)
			mu = starMassKg == null ? null : addMu(muOf(starMassKg), muOf(body.massKg))
		} else if (body.parentSystemId != null) {
			mu = barycenterMassKg == null ? null : addMu(muOf(barycenterMassKg), muOf(body.massKg))
		}
		const period = derivedPeriod(body.semiMajorAxisAu, mu)
		return period == null ? body : { ...body, orbitalPeriodDays: period }
	})

	return { stars: annotatedStars, bodies: annotatedBodies }
}
