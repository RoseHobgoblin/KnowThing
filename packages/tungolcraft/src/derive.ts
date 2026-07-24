/**
 * Composite "partial in → complete out" derivations: the convenience layer that
 * takes whatever a worldbuilder actually entered (loose numbers) and fills in
 * the rest as ready-to-display strings. Brands raw inputs at the boundary before
 * calling the physics engine, then bridges `physics` (numbers) and `format`.
 */

import {
	computeDensity, computeSurfaceGravity, computeEscapeVelocity,
	computeOrbitalPeriodDays, computeMeanOrbitalSpeed, computeHillSphereAu,
	computePeriastron, computeApastron,
} from './physics.js'
import {
	formatDensity, formatSurfaceGravity, formatEscapeVelocity,
	formatOrbitalVelocity, formatHillSphere, formatAu, formatPeriod, formatAuAsKm,
} from './format.js'
import { kg, m, au, days, addMu, muFromMass } from './units.js'

export interface BodyDerivedFields {
	density: string | null
	surfaceGravity: string | null
	escapeVelocity: string | null
}

export function deriveBodyFields(massKg: number | null, radiusM: number | null): BodyDerivedFields {
	if (massKg == null || radiusM == null || massKg <= 0 || radiusM <= 0) {
		return { density: null, surfaceGravity: null, escapeVelocity: null }
	}
	return {
		density: formatDensity(computeDensity(kg(massKg), m(radiusM))),
		surfaceGravity: formatSurfaceGravity(computeSurfaceGravity(kg(massKg), m(radiusM))),
		escapeVelocity: formatEscapeVelocity(computeEscapeVelocity(kg(massKg), m(radiusM))),
	}
}

export interface BodyDerivedOrbitalFields {
	orbitalPeriodDays: number | null
	meanOrbitalSpeed: string | null
	hillSphere: string | null
}

export function deriveBodyOrbitalFields(
	semiMajorAxisAu: number | null,
	orbitalPeriodDays: number | null,
	bodyMassKg: number | null,
	parentMassKg: number | null,
	eccentricity: number | null = null,
): BodyDerivedOrbitalFields {
	let period = orbitalPeriodDays

	// Compute orbital period from Kepler's third law if not provided, using the
	// two-body μ = G(parent + this body).
	if (period == null && semiMajorAxisAu != null && parentMassKg != null && semiMajorAxisAu > 0 && parentMassKg > 0) {
		period = computeOrbitalPeriodDays(au(semiMajorAxisAu), addMu(muFromMass(kg(parentMassKg)), muFromMass(kg(bodyMassKg ?? 0))))
	}

	const meanOrbitalSpeed = semiMajorAxisAu != null && period != null && period > 0
		? formatOrbitalVelocity(computeMeanOrbitalSpeed(au(semiMajorAxisAu), days(period), eccentricity ?? 0))
		: null

	const hillSphere = semiMajorAxisAu != null && bodyMassKg != null && parentMassKg != null
		&& semiMajorAxisAu > 0 && bodyMassKg > 0 && parentMassKg > 0
		? formatHillSphere(computeHillSphereAu(au(semiMajorAxisAu), kg(bodyMassKg), kg(parentMassKg), eccentricity))
		: null

	return { orbitalPeriodDays: period, meanOrbitalSpeed, hillSphere }
}

export interface StarDerivedOrbitalFields {
	periastron: string | null
	apastron: string | null
}

export function deriveStarOrbitalFields(semiMajorAxisAu: number | null, eccentricity: number | null): StarDerivedOrbitalFields {
	if (semiMajorAxisAu == null || eccentricity == null) {
		return { periastron: null, apastron: null }
	}
	return {
		periastron: formatAu(computePeriastron(au(semiMajorAxisAu), eccentricity)),
		apastron: formatAu(computeApastron(au(semiMajorAxisAu), eccentricity)),
	}
}

export interface DisplayStringFields {
	orbitalPeriod: string | null
	semiMajorAxis: string | null
	rotationPeriod: string | null
}

export function deriveDisplayStrings(
	orbitalPeriodDays: number | null,
	semiMajorAxisAu: number | null,
	rotationPeriodS: number | null,
): DisplayStringFields {
	return {
		orbitalPeriod: orbitalPeriodDays == null ? null : formatPeriod(orbitalPeriodDays * 86_400),
		semiMajorAxis: semiMajorAxisAu == null ? null : formatAuAsKm(semiMajorAxisAu),
		rotationPeriod: rotationPeriodS == null ? null : formatPeriod(rotationPeriodS),
	}
}
