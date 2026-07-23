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

export interface OrbitalValidationIssue {
	field: keyof OrbitalElements
	message: string
}

/** Raised when a public orbital operation receives values outside its model domain. */
export class OrbitalDomainError extends RangeError {
	constructor(message: string) {
		super(message)
		this.name = 'OrbitalDomainError'
	}
}

/** Raised when the numerical Kepler solver cannot meet its documented tolerance. */
export class KeplerConvergenceError extends Error {
	constructor(
		message: string,
		public readonly residual: number,
		public readonly iterations: number,
	) {
		super(message)
		this.name = 'KeplerConvergenceError'
	}
}

function finiteIssue(field: keyof OrbitalElements, value: number): OrbitalValidationIssue | null {
	return Number.isFinite(value) ? null : { field, message: `${field} must be finite; got ${value}` }
}

/**
 * Validate the bound, elliptical-orbit contract shared by every propagator.
 * This belongs in the package boundary: application schemas are not present
 * when Tungolcraft is consumed directly from npm.
 */
export function validateOrbitalElements(elements: OrbitalElements): OrbitalValidationIssue[] {
	const issues: OrbitalValidationIssue[] = []
	for (const field of [
		'semiMajorAxisAu',
		'eccentricity',
		'inclinationDeg',
		'longitudeAscendingNodeDeg',
		'argumentOfPeriapsisDeg',
		'epochPhase',
		'mu',
	] as const) {
		const issue = finiteIssue(field, elements[field])
		if (issue) issues.push(issue)
	}
	if (Number.isFinite(elements.semiMajorAxisAu) && elements.semiMajorAxisAu <= 0) {
		issues.push({ field: 'semiMajorAxisAu', message: 'semiMajorAxisAu must be greater than zero' })
	}
	if (Number.isFinite(elements.mu) && elements.mu <= 0) {
		issues.push({ field: 'mu', message: 'mu must be greater than zero' })
	}
	if (Number.isFinite(elements.eccentricity)
		&& (elements.eccentricity < 0 || elements.eccentricity >= 1)) {
		issues.push({ field: 'eccentricity', message: 'eccentricity must be in [0, 1) for a bound elliptical orbit' })
	}
	if (Number.isFinite(elements.epochPhase)
		&& (elements.epochPhase < 0 || elements.epochPhase > 1)) {
		issues.push({ field: 'epochPhase', message: 'epochPhase must be in [0, 1]' })
	}
	return issues
}

export function assertValidOrbitalElements(elements: OrbitalElements): void {
	const issues = validateOrbitalElements(elements)
	if (issues.length > 0) {
		throw new OrbitalDomainError(
			`Invalid orbital elements: ${issues.map(issue => `${issue.field}: ${issue.message}`).join('; ')}`,
		)
	}
}

function assertFinite(name: string, value: number): void {
	if (!Number.isFinite(value)) throw new OrbitalDomainError(`${name} must be finite; got ${value}`)
}

function assertEllipticalEccentricity(ecc: number): void {
	assertFinite('eccentricity', ecc)
	if (ecc < 0 || ecc >= 1) {
		throw new OrbitalDomainError(`eccentricity must be in [0, 1) for a bound elliptical orbit; got ${ecc}`)
	}
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
	assertFinite('orbitalPeriodDays', orbitalPeriodDays)
	assertFinite('epochPhase', epochPhase)
	assertFinite('absoluteDay', absoluteDay)
	if (orbitalPeriodDays <= 0) throw new OrbitalDomainError('orbitalPeriodDays must be greater than zero')
	if (epochPhase < 0 || epochPhase > 1) throw new OrbitalDomainError('epochPhase must be in [0, 1]')
	const fractionOfOrbit = (absoluteDay / orbitalPeriodDays) + epochPhase
	return (((fractionOfOrbit % 1) + 1) % 1) * Math.PI * 2
}

/**
 * Solve Kepler's equation  M = E − e·sin(E)  for eccentric anomaly E
 * with a safeguarded Newton/bisection iteration.
 *
 * Only bound orbits are supported. `e ≥ 1` (parabolic/hyperbolic) is a different
 * conic with no elliptical eccentric anomaly. As `e → 1`, an unrestricted
 * Newton step becomes poorly conditioned near periapsis; the maintained bracket
 * prevents divergence. Rather than cosmetically repair invalid input into an
 * apparently plausible answer for a *different* orbit, this refuses
 * out-of-domain eccentricity. The
 * package itself enforces `0 ≤ e < 1`, independently of an application's schema.
 *
 * @param M - mean anomaly in radians
 * @param ecc - orbital eccentricity, must satisfy 0 ≤ e < 1
 * @returns eccentric anomaly E in radians
 * @throws RangeError if `ecc` is outside [0, 1)
 */
export function solveKeplerE(M: number, ecc: number): number {
	assertFinite('mean anomaly', M)
	assertEllipticalEccentricity(ecc)
	if (ecc < 1e-12) return M

	// Reduce M to [-π, π] for a compact, well-conditioned solve, preserving the
	// removed whole turns so the returned E corresponds to the caller's M.
	const tau = 2 * Math.PI
	const turns = Math.floor((M + Math.PI) / tau)
	const reducedM = M - turns * tau

	// f(E) = E - e sin(E) - M is strictly increasing for e < 1 and its root is
	// bracketed by [M-e, M+e]. Use Newton when its step remains in the bracket,
	// otherwise bisect. This cannot diverge even at e -> 1 near periapsis.
	let lower = reducedM - ecc
	let upper = reducedM + ecc
	let E = ecc < 0.8
		? reducedM + ecc * Math.sin(reducedM)
		: (reducedM < 0 ? -Math.PI : Math.PI)
	if (E <= lower || E >= upper) E = (lower + upper) / 2

	const tolerance = 1e-13
	const maxIterations = 64
	for (let step = 1; step <= maxIterations; step++) {
		const residual = E - ecc * Math.sin(E) - reducedM
		if (Math.abs(residual) <= tolerance) return E + turns * tau

		if (residual > 0) upper = E
		else lower = E

		const derivative = 1 - ecc * Math.cos(E)
		const candidate = E - residual / derivative
		E = Number.isFinite(candidate) && candidate > lower && candidate < upper
			? candidate
			: (lower + upper) / 2
	}

	const residual = Math.abs(E - ecc * Math.sin(E) - reducedM)
	throw new KeplerConvergenceError(
		`solveKeplerE failed to converge after ${maxIterations} iterations (e=${ecc}, M=${M}, residual=${residual})`,
		residual,
		maxIterations,
	)
}

/**
 * Mean motion n = √(μ/a³) — the orbit's average angular rate, in radians per
 * second. The constant of Kepler propagation: M(t) = M₀ + n·t, and the period
 * is 2π/n.
 */
export function meanMotion(mu: GravitationalParameter, semiMajorAxisAu: AstronomicalUnits): number {
	assertFinite('mu', mu)
	assertFinite('semiMajorAxisAu', semiMajorAxisAu)
	if (mu <= 0) throw new OrbitalDomainError('mu must be greater than zero')
	if (semiMajorAxisAu <= 0) throw new OrbitalDomainError('semiMajorAxisAu must be greater than zero')
	const a = semiMajorAxisAu * AU_M
	return Math.sqrt(mu / a ** 3)
}

/**
 * True anomaly ν from eccentric anomaly E (radians), the exact conversion
 *   tan(ν/2) = √((1+e)/(1−e))·tan(E/2)
 * written with atan2 so it stays correct through all four quadrants.
 */
export function trueAnomaly(eccentricAnomalyRad: number, ecc: number): number {
	assertFinite('eccentric anomaly', eccentricAnomalyRad)
	assertEllipticalEccentricity(ecc)
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
	assertValidOrbitalElements(elements)
	assertFinite('true anomaly', trueAnomalyRad)
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
	assertValidOrbitalElements(elements)
	assertFinite('absoluteDay', absoluteDay)
	const periodDays = (2 * Math.PI) / meanMotion(elements.mu, elements.semiMajorAxisAu) / 86_400
	const M = meanAnomaly(periodDays, elements.epochPhase, absoluteDay)
	const E = solveKeplerE(M, elements.eccentricity)
	return stateVectorAtTrueAnomaly(elements, trueAnomaly(E, elements.eccentricity))
}
