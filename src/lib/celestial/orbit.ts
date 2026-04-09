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
 * @param e - orbital eccentricity (0 ≤ e < 1)
 * @returns eccentric anomaly E in radians
 */
export function solveKeplerE(M: number, e: number): number {
	if (e < 1e-12) return M
	let E = M + e * Math.sin(M) // good initial guess
	for (let i = 0; i < 15; i++) {
		const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
		E -= dE
		if (Math.abs(dE) < 1e-12) break
	}
	return E
}
