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
 * @param M - mean anomaly in radians
 * @param ecc - orbital eccentricity (0 ≤ e < 1)
 * @returns eccentric anomaly E in radians
 */
export function solveKeplerE(M: number, ecc: number): number {
	if (ecc < 1e-12) return M
	// Guard against unbound/degenerate orbits (e ≥ 1) that would divide by zero
	// below. The data layer rejects these, but legacy rows might still carry them.
	if (ecc >= 1) ecc = 0.999
	let E = M + ecc * Math.sin(M) // good initial guess
	for (let step = 0; step < 15; step++) {
		const dE = (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E))
		E -= dE
		if (Math.abs(dE) < 1e-12) break
	}
	return E
}
