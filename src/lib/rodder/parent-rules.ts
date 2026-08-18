/**
 * Parent-kind rules for the unified rodder hierarchy.
 *
 * A rodder entity's dynamical role (planet vs moon vs companion star vs
 * circumbinary planet) is never stored — it falls out of what the entity
 * orbits. A `system` parent is the system barycenter: stars orbiting it are
 * binary components, bodies orbiting it are circumbinary. These rules say which
 * kinds may orbit which, and are the only structural constraint on the graph
 * besides acyclicity (enforced separately with a DB walk in the service).
 *
 * Pure and DB-free so the full matrix is unit-testable.
 */

export const RODDER_KINDS = ['system', 'star', 'body'] as const
export type RodderKind = (typeof RODDER_KINDS)[number]

export function isRodderKind(value: unknown): value is RodderKind {
	return typeof value === 'string' && (RODDER_KINDS as readonly string[]).includes(value)
}

const ALLOWED_PARENTS: Record<RodderKind, readonly RodderKind[]> = {
	system: [],
	star: ['system', 'star'],
	// A system parent means the body orbits the system barycenter — a
	// circumbinary planet (or belt) around the combined stars.
	body: ['system', 'star', 'body'],
}

const KIND_LABEL: Record<RodderKind, string> = {
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
	kind: RodderKind,
	parentKind: RodderKind | null,
	bodyType?: string | null,
): string | null {
	if (parentKind == null) {
		// Bodies always orbit something; systems never do; stars may be field
		// stars outside any system.
		if (kind === 'body') return 'Rodder bodies must orbit a parent system, star, or body'
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
