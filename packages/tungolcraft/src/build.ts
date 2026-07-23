/**
 * Human-unit authoring API — the friendly front door to the engine.
 *
 * `deriveBody`/`deriveStar` take loose raw-SI rows (the path a database or form
 * feeds). `body`/`star` here take a clean input object whose physical fields are
 * *branded* quantities with unsuffixed names (`mass`, not `massKg`): the type
 * forces a unit constructor, so a worldbuilder writes `mass: solarMasses(2.3)`
 * or `radius: earthRadii(1)` instead of `1.989e30`, and the compiler rejects a
 * bare number or the wrong unit before it ever reaches the physics.
 *
 * They convert to the SI row and delegate to `deriveBody`/`deriveStar`, so the
 * two entry points always produce identical models.
 */

import { deriveBody, deriveStar } from './models.js'
import type { BodyModel, StarModel, BodyRow, StarRow, BodyRelations, StarRelations } from './models.js'
import type {
	Kilograms, Metres, AstronomicalUnits, Days, Seconds, Kelvin, Watts,
} from './units.js'

/** Fallback identifier when no explicit slug is given: a kebab-cased name. */
function slugify(name: string): string {
	return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export interface BodyInput {
	name: string
	/** Stable identifier; defaults to a kebab-cased `name`. */
	slug?: string
	description?: string | null
	bodyType?: string | null

	// Physical / orbital — branded quantities (use kg/solarMasses, m/earthRadii, au, …).
	mass?: Kilograms | null
	radius?: Metres | null
	semiMajorAxis?: AstronomicalUnits | null
	orbitalPeriod?: Days | null
	eccentricity?: number | null
	inclination?: number | null
	rotationPeriod?: Seconds | null
	axialTilt?: number | null

	// Free-form passthrough text.
	temperature?: string | null
	age?: string | null
	composition?: string | null
	atmosphere?: string | null
	surfacePressure?: string | null
	apparentMagnitude?: string | null
	angularDiameter?: string | null
	albedo?: string | null
	satellites?: number | null
	hasRings?: boolean | null
	extra?: unknown
}

export interface StarInput {
	name: string
	/** Stable identifier; defaults to a kebab-cased `name`. */
	slug?: string
	description?: string | null

	// Physical / orbital — branded quantities.
	mass?: Kilograms | null
	radius?: Metres | null
	temperature?: Kelvin | null
	luminosity?: Watts | null
	/** Relative semi-major axis of the stellar pair: a_rel = a1 + a2. */
	relativeSemiMajorAxis?: AstronomicalUnits | null
	/** @deprecated Use `relativeSemiMajorAxis`; this alias has the same relative-orbit semantics. */
	semiMajorAxis?: AstronomicalUnits | null
	orbitalPeriod?: Days | null
	eccentricity?: number | null
	rotationPeriod?: Seconds | null
	axialTilt?: number | null

	// Free-form passthrough text.
	spectralType?: string | null
	luminosityVisual?: string | null
	age?: string | null
	color?: string | null
	metallicity?: string | null
	apparentMagnitude?: string | null
	absoluteMagnitude?: string | null
	angularDiameter?: string | null
	extra?: unknown
}

/** Build a complete body model from friendly, unit-safe input. */
export function body(input: BodyInput, relations: BodyRelations = {}): BodyModel {
	const row: BodyRow = {
		name: input.name,
		slug: input.slug ?? slugify(input.name),
		description: input.description,
		bodyType: input.bodyType,
		massKg: input.mass,
		radiusM: input.radius,
		semiMajorAxisAu: input.semiMajorAxis,
		orbitalPeriodDays: input.orbitalPeriod,
		eccentricity: input.eccentricity,
		inclination: input.inclination,
		rotationPeriodS: input.rotationPeriod,
		axialTilt: input.axialTilt,
		temperature: input.temperature,
		age: input.age,
		composition: input.composition,
		atmosphere: input.atmosphere,
		surfacePressure: input.surfacePressure,
		apparentMagnitude: input.apparentMagnitude,
		angularDiameter: input.angularDiameter,
		albedo: input.albedo,
		satellites: input.satellites,
		hasRings: input.hasRings,
		extra: input.extra,
	}
	return deriveBody(row, relations)
}

/** Build a complete star model from friendly, unit-safe input. */
export function star(input: StarInput, relations: StarRelations = {}): StarModel {
	const row: StarRow = {
		name: input.name,
		slug: input.slug ?? slugify(input.name),
		description: input.description,
		massKg: input.mass,
		radiusM: input.radius,
		temperatureK: input.temperature,
		luminosityW: input.luminosity,
		relativeSemiMajorAxisAu: input.relativeSemiMajorAxis ?? input.semiMajorAxis,
		orbitalPeriodDays: input.orbitalPeriod,
		eccentricity: input.eccentricity,
		rotationPeriodS: input.rotationPeriod,
		axialTilt: input.axialTilt,
		spectralType: input.spectralType,
		luminosityVisual: input.luminosityVisual,
		age: input.age,
		color: input.color,
		metallicity: input.metallicity,
		apparentMagnitude: input.apparentMagnitude,
		absoluteMagnitude: input.absoluteMagnitude,
		angularDiameter: input.angularDiameter,
		extra: input.extra,
	}
	return deriveStar(row, relations)
}
