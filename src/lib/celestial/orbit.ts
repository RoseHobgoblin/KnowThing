/**
 * Compute a body's angular position on its orbit for a given absolute day.
 * Returns angle in radians (0 = periapsis direction).
 *
 * @param orbitalPeriodDays - the body's orbital period in days
 * @param epochPhase - position at day 0 (0-1, fraction of orbit)
 * @param absoluteDay - the current absolute day number
 */
export function orbitalAngle(
	orbitalPeriodDays: number,
	epochPhase: number,
	absoluteDay: number,
): number {
	if (orbitalPeriodDays <= 0) return 0
	const fractionOfOrbit = (absoluteDay / orbitalPeriodDays) + epochPhase
	return (((fractionOfOrbit % 1) + 1) % 1) * Math.PI * 2
}
