/**
 * Typed celestial view models.
 *
 * These are the canonical, presentation-independent representation of a star or
 * planet: raw SI numbers and structured relationships, NOT formatted strings and
 * NOT infobox field names. Every consumer (infobox, stat grid, JSON API, map)
 * is a *projection* of one of these models — the model is never shaped for any
 * single consumer. See `projections.ts` for the projections.
 *
 * Derivation is pure: `deriveBody`/`deriveStar` take plain data (a DB row plus
 * already-resolved relations) and compute everything with the formulas in
 * `compute.js`. No DB access, no formatting — fully unit-testable.
 */

import {
	computeDensity,
	computeSurfaceGravity,
	computeEscapeVelocity,
	computeOrbitalPeriodDays,
	computeOrbitalVelocity,
	computePeriastron,
	computeApastron,
	computeHabitableZoneAu,
	computeLuminosity,
} from 'tungolcraft'

/** A link to another celestial entity. */
export interface Ref {
	name: string
	slug: string
}

/** Raw stored physical/orbital columns shared by stars and planetary bodies. */
export interface CelestialRowLike {
	name: string
	slug: string
	description?: string | null
	massKg?: number | null
	radiusM?: number | null
	semiMajorAxisAu?: number | null
	orbitalPeriodDays?: number | null
	eccentricity?: number | null
	rotationPeriodS?: number | null
	axialTilt?: number | null
	extra?: unknown
}

export interface BodyRow extends CelestialRowLike {
	bodyType?: string | null
	temperature?: string | null
	age?: string | null
	composition?: string | null
	atmosphere?: string | null
	surfacePressure?: string | null
	inclination?: number | null
	apparentMagnitude?: string | null
	angularDiameter?: string | null
	albedo?: string | null
	satellites?: number | null
	hasRings?: boolean | null
}

export interface StarRow extends CelestialRowLike {
	spectralType?: string | null
	luminosityW?: number | null
	luminosityVisual?: string | null
	temperatureK?: number | null
	age?: string | null
	color?: string | null
	metallicity?: string | null
	apparentMagnitude?: string | null
	absoluteMagnitude?: string | null
	angularDiameter?: string | null
}

/** Relations resolved by the caller (the DB layer), passed into the pure derive. */
export interface BodyRelations {
	star?: (Ref & { massKg: number | null }) | null
	parentBody?: (Ref & { massKg: number | null }) | null
	/** The parent system for a circumbinary body — massKg is the system's total stellar mass. */
	system?: (Ref & { massKg: number | null }) | null
	/** Direct child bodies, for the derived satellite count. */
	moonCount?: number
}

export interface StarRelations {
	parentStar?: (Ref & { massKg?: number | null }) | null
	/** Total stellar mass of the parent system when the star orbits its barycenter. */
	barycenterMassKg?: number | null
	/**
	 * Stars gravitationally paired with this one, derived from the graph:
	 * child stars orbiting it plus co-components of the same barycenter.
	 */
	companions?: Ref[]
	planetCount?: number
	satelliteCount?: number
}

/** Extra/override overflow, string-valued (as stored by the configure forms). */
export type ExtraMap = Record<string, string>

export interface BodyModel {
	kind: 'body'
	name: string
	slug: string
	bodyType: string
	description: string | null

	// Passthrough text (free-form, stored verbatim).
	temperature: string | null
	age: string | null
	composition: string | null
	atmosphere: string | null
	surfacePressure: string | null
	apparentMagnitude: string | null
	angularDiameter: string | null
	albedo: string | null

	// Physical — raw SI.
	massKg: number | null
	radiusM: number | null
	densityKgM3: number | null
	gravityMs2: number | null
	escapeVelocityMs: number | null
	circumferenceM: number | null
	surfaceAreaM2: number | null
	volumeM3: number | null

	// Orbital.
	semiMajorAxisAu: number | null
	orbitalPeriodDays: number | null
	orbitalVelocityMs: number | null
	eccentricity: number | null
	inclination: number | null
	periapsisAu: number | null
	apoapsisAu: number | null

	// Rotation.
	rotationPeriodS: number | null
	axialTilt: number | null
	equatorialVelocityMs: number | null

	// System.
	satellites: number | null
	hasRings: boolean

	// Relationships.
	star: Ref | null
	parentBody: Ref | null
	/** The parent system, when this body orbits a system barycenter (circumbinary). */
	system: Ref | null
	/** What this orbits directly — parent body if a moon, else the star, else the system barycenter. */
	satelliteOf: Ref | null

	extra: ExtraMap
}

export interface StarModel {
	kind: 'star'
	name: string
	slug: string
	description: string | null

	// Passthrough text.
	spectralType: string | null
	luminosityVisual: string | null
	age: string | null
	color: string | null
	metallicity: string | null
	apparentMagnitude: string | null
	absoluteMagnitude: string | null
	angularDiameter: string | null

	// Physical — raw SI.
	massKg: number | null
	radiusM: number | null
	temperatureK: number | null
	luminosityW: number | null
	densityKgM3: number | null
	gravityMs2: number | null
	escapeVelocityMs: number | null

	// Orbital (binary/multiple).
	semiMajorAxisAu: number | null
	orbitalPeriodDays: number | null
	eccentricity: number | null
	periastronAu: number | null
	apastronAu: number | null

	// Rotation.
	rotationPeriodS: number | null
	axialTilt: number | null
	equatorialVelocityMs: number | null

	// Derived environment.
	habitableZoneAu: { inner: number, outer: number } | null

	// Relationships & counts.
	companionOf: Ref | null
	/** Derived from the graph: child stars + co-components of the same barycenter. */
	companions: Ref[]
	planetCount: number
	satelliteCount: number

	extra: ExtraMap
}

/** Coerce a stored jsonb `extra` blob to a string-valued map (skipping empties). */
function toExtraMap(extra: unknown): ExtraMap {
	const out: ExtraMap = {}
	if (!extra || typeof extra !== 'object') return out
	for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
		if (v != null && v !== '') out[k] = String(v)
	}
	return out
}

const positive = (n: number | null | undefined): number | null => (n != null && n > 0 ? n : null)

/** Apply `f` to a value when present, else null. */
function mapNum(n: number | null, f: (n: number) => number): number | null {
	return n == null ? null : f(n)
}

export function deriveBody(row: BodyRow, relations: BodyRelations = {}): BodyModel {
	const massKg = positive(row.massKg)
	const radiusM = positive(row.radiusM)
	const semiMajorAxisAu = positive(row.semiMajorAxisAu)
	const rotationPeriodS = positive(row.rotationPeriodS)
	const eccentricity = row.eccentricity ?? null

	// A moon orbits its parent body; a planet orbits the star; a circumbinary
	// body orbits the system barycenter (whose mass is the total stellar mass).
	// Its period, if not stored, derives from whichever primary it circles.
	const primaryMassKg = relations.parentBody?.massKg ?? relations.star?.massKg ?? relations.system?.massKg ?? null
	const orbitalPeriodDays = row.orbitalPeriodDays
		?? (semiMajorAxisAu != null && primaryMassKg != null && primaryMassKg > 0
			? computeOrbitalPeriodDays(semiMajorAxisAu, primaryMassKg)
			: null)

	const orbitalVelocityMs = semiMajorAxisAu != null && orbitalPeriodDays != null && orbitalPeriodDays > 0
		? computeOrbitalVelocity(semiMajorAxisAu, orbitalPeriodDays)
		: null

	const star = relations.star ? { name: relations.star.name, slug: relations.star.slug } : null
	const parentBody = relations.parentBody ? { name: relations.parentBody.name, slug: relations.parentBody.slug } : null
	const system = relations.system ? { name: relations.system.name, slug: relations.system.slug } : null

	return {
		kind: 'body',
		name: row.name,
		slug: row.slug,
		bodyType: row.bodyType ?? 'planet',
		description: row.description ?? null,

		temperature: row.temperature ?? null,
		age: row.age ?? null,
		composition: row.composition ?? null,
		atmosphere: row.atmosphere ?? null,
		surfacePressure: row.surfacePressure ?? null,
		apparentMagnitude: row.apparentMagnitude ?? null,
		angularDiameter: row.angularDiameter ?? null,
		albedo: row.albedo ?? null,

		massKg,
		radiusM,
		densityKgM3: massKg != null && radiusM != null ? computeDensity(massKg, radiusM) : null,
		gravityMs2: massKg != null && radiusM != null ? computeSurfaceGravity(massKg, radiusM) : null,
		escapeVelocityMs: massKg != null && radiusM != null ? computeEscapeVelocity(massKg, radiusM) : null,
		circumferenceM: mapNum(radiusM, r => 2 * Math.PI * r),
		surfaceAreaM2: mapNum(radiusM, r => 4 * Math.PI * r * r),
		volumeM3: mapNum(radiusM, r => (4 / 3) * Math.PI * r ** 3),

		semiMajorAxisAu,
		orbitalPeriodDays,
		orbitalVelocityMs,
		eccentricity,
		inclination: row.inclination ?? null,
		periapsisAu: semiMajorAxisAu != null && eccentricity != null ? computePeriastron(semiMajorAxisAu, eccentricity) : null,
		apoapsisAu: semiMajorAxisAu != null && eccentricity != null ? computeApastron(semiMajorAxisAu, eccentricity) : null,

		rotationPeriodS,
		axialTilt: row.axialTilt ?? null,
		equatorialVelocityMs: radiusM != null && rotationPeriodS != null ? (2 * Math.PI * radiusM) / rotationPeriodS : null,

		satellites: row.satellites ?? relations.moonCount ?? null,
		hasRings: row.hasRings ?? false,

		star,
		parentBody,
		system,
		satelliteOf: parentBody ?? star ?? system,

		extra: toExtraMap(row.extra),
	}
}

export function deriveStar(row: StarRow, relations: StarRelations = {}): StarModel {
	const massKg = positive(row.massKg)
	const radiusM = positive(row.radiusM)
	const temperatureK = positive(row.temperatureK)
	const rotationPeriodS = positive(row.rotationPeriodS)
	const semiMajorAxisAu = positive(row.semiMajorAxisAu)
	const eccentricity = row.eccentricity ?? null

	// Luminosity: explicit, else Stefan-Boltzmann from radius + temperature.
	const luminosityW = positive(row.luminosityW)
		?? (radiusM != null && temperatureK != null ? computeLuminosity(radiusM, temperatureK) : null)

	// Binary/barycentric orbital period: explicit, else Kepler from the semi-major
	// axis and the pair's combined mass (companion of a star) or the system's
	// total stellar mass (component orbiting the barycenter).
	const pairMassKg = relations.parentStar?.massKg != null && relations.parentStar.massKg > 0
		? relations.parentStar.massKg + (massKg ?? 0)
		: null
	const primaryMassKg = pairMassKg ?? positive(relations.barycenterMassKg)
	const orbitalPeriodDays = row.orbitalPeriodDays
		?? (semiMajorAxisAu != null && primaryMassKg != null
			? computeOrbitalPeriodDays(semiMajorAxisAu, primaryMassKg)
			: null)

	return {
		kind: 'star',
		name: row.name,
		slug: row.slug,
		description: row.description ?? null,

		spectralType: row.spectralType ?? null,
		luminosityVisual: row.luminosityVisual ?? null,
		age: row.age ?? null,
		color: row.color ?? null,
		metallicity: row.metallicity ?? null,
		apparentMagnitude: row.apparentMagnitude ?? null,
		absoluteMagnitude: row.absoluteMagnitude ?? null,
		angularDiameter: row.angularDiameter ?? null,

		massKg,
		radiusM,
		temperatureK,
		luminosityW,
		densityKgM3: massKg != null && radiusM != null ? computeDensity(massKg, radiusM) : null,
		gravityMs2: massKg != null && radiusM != null ? computeSurfaceGravity(massKg, radiusM) : null,
		escapeVelocityMs: massKg != null && radiusM != null ? computeEscapeVelocity(massKg, radiusM) : null,

		semiMajorAxisAu,
		orbitalPeriodDays,
		eccentricity,
		periastronAu: semiMajorAxisAu != null && eccentricity != null ? computePeriastron(semiMajorAxisAu, eccentricity) : null,
		apastronAu: semiMajorAxisAu != null && eccentricity != null ? computeApastron(semiMajorAxisAu, eccentricity) : null,

		rotationPeriodS,
		axialTilt: row.axialTilt ?? null,
		equatorialVelocityMs: radiusM != null && rotationPeriodS != null ? (2 * Math.PI * radiusM) / rotationPeriodS : null,

		habitableZoneAu: luminosityW != null && luminosityW > 0 ? computeHabitableZoneAu(luminosityW) : null,

		companionOf: relations.parentStar ? { name: relations.parentStar.name, slug: relations.parentStar.slug } : null,
		companions: relations.companions ?? [],
		planetCount: relations.planetCount ?? 0,
		satelliteCount: relations.satelliteCount ?? 0,

		extra: toExtraMap(row.extra),
	}
}
