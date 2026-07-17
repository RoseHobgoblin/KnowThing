/**
 * Parent-kind rules for the unified celestial hierarchy.
 *
 * A celestial entity's dynamical role (planet vs moon vs companion star) is
 * never stored — it falls out of what the entity orbits. These rules say which
 * kinds may orbit which, and are the only structural constraint on the graph
 * besides acyclicity (enforced separately with a DB walk in the service).
 *
 * Pure and DB-free so the full matrix is unit-testable.
 */

export const CELESTIAL_KINDS = ['system', 'star', 'body'] as const
export type CelestialKind = (typeof CELESTIAL_KINDS)[number]

export function isCelestialKind(value: unknown): value is CelestialKind {
	return typeof value === 'string' && (CELESTIAL_KINDS as readonly string[]).includes(value)
}

const ALLOWED_PARENTS: Record<CelestialKind, readonly CelestialKind[]> = {
	system: [],
	star: ['system', 'star'],
	body: ['star', 'body'],
}

const KIND_LABEL: Record<CelestialKind, string> = {
	system: 'star system',
	star: 'star',
	body: 'body',
}

/**
 * Validate that `kind` may have a parent of `parentKind` (null = no parent).
 * Returns an error message, or null when the combination is legal.
 *
 * `bodyType` tightens the rule for ring systems, which must orbit a body.
 */
export function validateParentKind(
	kind: CelestialKind,
	parentKind: CelestialKind | null,
	bodyType?: string | null,
): string | null {
	if (parentKind == null) {
		// Bodies always orbit something; systems never do; stars may be field
		// stars outside any system.
		if (kind === 'body') return 'Celestial bodies must orbit a parent star or body'
		return null
	}
	if (kind === 'system') return 'Star systems cannot orbit a parent'
	if (!ALLOWED_PARENTS[kind].includes(parentKind)) {
		return `A ${KIND_LABEL[kind]} cannot orbit a ${KIND_LABEL[parentKind]}`
	}
	if (kind === 'body' && bodyType === 'ring_system' && parentKind !== 'body') {
		return 'Ring systems must orbit a parent body'
	}
	return null
}
