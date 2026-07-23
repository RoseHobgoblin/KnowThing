/**
 * Two-body orbital position: mean anomaly over time and the Kepler-equation
 * solver for eccentric anomaly. Pure math; feed it to a projection to place a
 * body along its ellipse at a given epoch.
 */

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
