/**
 * Two-body orbital position: mean anomaly over time, the Kepler-equation solver
 * for eccentric anomaly, and full Keplerian propagation — classical elements →
 * position + velocity state vector at a true anomaly or an epoch. Pure math; the
 * state vectors live in the parent-centred inertial frame (reference/ecliptic
 * plane = XY), ready for a projection to place a body in space or on a sky.
 */

import { AU_M } from './constants.js'
import type { AstronomicalUnits, GravitationalParameter } from './units.js'

const DEG = Math.PI / 180

/**
 * A 3D vector in the parent-centred inertial frame: the XY-plane is the
 * reference plane (the ecliptic analogue), +X points at the reference
 * direction. Metres for a position, m/s for a velocity.
 */
export interface Vec3 { x: number, y: number, z: number }

/** A body's instantaneous two-body state: position (m) and velocity (m/s). */
export interface StateVector { position: Vec3, velocity: Vec3 }

/**
 * Classical (Keplerian) orbital elements — the six numbers that pin an orbit in
 * space plus the μ that sets its timing. Orientation angles are in degrees to
 * match the stored data (`inclination`, Ω, ω); `semiMajorAxisAu` is in AU;
 * `epochPhase` is the mean anomaly at day 0 as a fraction of the orbit (0–1);
 * `mu` is the system's total μ = G(M + m) (see `addMu`).
 */
export interface OrbitalElements {
	semiMajorAxisAu: AstronomicalUnits
	eccentricity: number
	inclinationDeg: number
	longitudeAscendingNodeDeg: number
	argumentOfPeriapsisDeg: number
	epochPhase: number
	mu: GravitationalParameter
}

/**
 * Compute the mean anomaly for a given absolute day.
 * Returns angle in radians, normalised to [0, 2π).
 *
 * @param orbitalPeriodDays - the body's orbital period in days
 * @param epochPhase - position at day 0 (0-1, fraction of orbit)
 * @param absoluteDay - the current absolute day number
 */
export function meanAnomaly(
	orbitalPeriodDays: number,
	epochPhase: number,
	absoluteDay: number,
): number {
	if (orbitalPeriodDays <= 0) return 0
	const fractionOfOrbit = (absoluteDay / orbitalPeriodDays) + epochPhase
	return (((fractionOfOrbit % 1) + 1) % 1) * Math.PI * 2
}

/**
 * Solve Kepler's equation  M = E − e·sin(E)  for eccentric anomaly E
 * using Newton–Raphson iteration.
 *
 * Only bound orbits are supported. `e ≥ 1` (parabolic/hyperbolic) is a different
 * conic with no eccentric anomaly, and the Newton step below divides by zero as
 * `e → 1`. Rather than cosmetically repair the input into a plausible-looking
 * answer for a *different* orbit, this refuses out-of-domain eccentricity. The
 * invariant `0 ≤ e < 1` is enforced at the data layer (schema `.lt(1)`), so a
 * throw here means a real bug upstream, not user input to paper over.
 *
 * @param M - mean anomaly in radians
 * @param ecc - orbital eccentricity, must satisfy 0 ≤ e < 1
 * @returns eccentric anomaly E in radians
 * @throws RangeError if `ecc` is outside [0, 1)
 */
export function solveKeplerE(M: number, ecc: number): number {
	if (ecc < 0 || ecc >= 1) {
		throw new RangeError(`solveKeplerE: eccentricity must be in [0, 1); got ${ecc}`)
	}
	if (ecc < 1e-12) return M
	let E = M + ecc * Math.sin(M) // good initial guess
	for (let step = 0; step < 15; step++) {
		const dE = (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E))
		E -= dE
		if (Math.abs(dE) < 1e-12) break
	}
	return E
}

/**
 * Mean motion n = √(μ/a³) — the orbit's average angular rate, in radians per
 * second. The constant of Kepler propagation: M(t) = M₀ + n·t, and the period
 * is 2π/n.
 */
export function meanMotion(mu: GravitationalParameter, semiMajorAxisAu: AstronomicalUnits): number {
	const a = semiMajorAxisAu * AU_M
	return Math.sqrt(mu / a ** 3)
}

/**
 * True anomaly ν from eccentric anomaly E (radians), the exact conversion
 *   tan(ν/2) = √((1+e)/(1−e))·tan(E/2)
 * written with atan2 so it stays correct through all four quadrants.
 */
export function trueAnomaly(eccentricAnomalyRad: number, ecc: number): number {
	const halfE = eccentricAnomalyRad / 2
	return 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(halfE), Math.sqrt(1 - ecc) * Math.cos(halfE))
}

/**
 * Rotate a perifocal-frame vector (orbit in its own plane, +x toward periapsis)
 * into the parent inertial frame via the 3-1-3 rotation R = R_z(Ω)·R_x(i)·R_z(ω).
 * Perifocal vectors are planar (z = 0), so only the first two columns matter.
 */
function perifocalToInertial(v: Vec3, incRad: number, nodeRad: number, argRad: number): Vec3 {
	const cw = Math.cos(argRad), sw = Math.sin(argRad)
	const ci = Math.cos(incRad), si = Math.sin(incRad)
	const co = Math.cos(nodeRad), so = Math.sin(nodeRad)
	return {
		x: (co * cw - so * sw * ci) * v.x + (-co * sw - so * cw * ci) * v.y,
		y: (so * cw + co * sw * ci) * v.x + (-so * sw + co * cw * ci) * v.y,
		z: (sw * si) * v.x + (cw * si) * v.y,
	}
}

/**
 * Position + velocity at a given true anomaly ν (radians). Builds the state in
 * the perifocal frame — r = p/(1 + e·cosν) with p = a(1−e²), the standard
 * conic — then rotates it into the inertial frame by (Ω, i, ω). The velocity
 * carries the vis-viva magnitude automatically; `velocityAtTrueAnomaly` is the
 * velocity half alone.
 */
export function stateVectorAtTrueAnomaly(elements: OrbitalElements, trueAnomalyRad: number): StateVector {
	const a = elements.semiMajorAxisAu * AU_M
	const { eccentricity: ecc, mu } = elements
	const p = a * (1 - ecc * ecc)
	const cosNu = Math.cos(trueAnomalyRad), sinNu = Math.sin(trueAnomalyRad)
	const r = p / (1 + ecc * cosNu)
	const k = Math.sqrt(mu / p)
	const posPerifocal: Vec3 = { x: r * cosNu, y: r * sinNu, z: 0 }
	const velPerifocal: Vec3 = { x: -k * sinNu, y: k * (ecc + cosNu), z: 0 }
	const inc = elements.inclinationDeg * DEG
	const node = elements.longitudeAscendingNodeDeg * DEG
	const arg = elements.argumentOfPeriapsisDeg * DEG
	return {
		position: perifocalToInertial(posPerifocal, inc, node, arg),
		velocity: perifocalToInertial(velPerifocal, inc, node, arg),
	}
}

/** Inertial-frame velocity vector (m/s) at a given true anomaly ν (radians). */
export function velocityAtTrueAnomaly(elements: OrbitalElements, trueAnomalyRad: number): Vec3 {
	return stateVectorAtTrueAnomaly(elements, trueAnomalyRad).velocity
}

/**
 * Full state vector at an absolute day: propagate the mean anomaly from the
 * epoch (period from n = √(μ/a³)), solve Kepler's equation for the eccentric
 * anomaly, convert to true anomaly, and place the body. This is the composition
 * of everything above — the one call a caller needs to know where a body is and
 * how fast it moves at a given in-world time.
 */
export function stateVectorAtEpoch(elements: OrbitalElements, absoluteDay: number): StateVector {
	const periodDays = (2 * Math.PI) / meanMotion(elements.mu, elements.semiMajorAxisAu) / 86_400
	const M = meanAnomaly(periodDays, elements.epochPhase, absoluteDay)
	const E = solveKeplerE(M, elements.eccentricity)
	return stateVectorAtTrueAnomaly(elements, trueAnomaly(E, elements.eccentricity))
}
