import type { ParamMatcher } from '@sveltejs/kit'

/**
 * Matches `Namespace:Identifier` URL segments — anything containing a colon
 * after a leading letter. The namespace registry validates the prefix
 * server-side; this matcher only acts as a routing predicate.
 *
 * Examples:
 *   /Celestial:Therne          ✓
 *   /Calendar:Iron_Flowers     ✓
 *   /Category:Mountains/Sub    ✓ (subpath after identifier kept by [...catchall])
 *   /know/Therne               ✗ (no colon in first segment)
 */
export const match: ParamMatcher = (param) => /^[A-Za-z][A-Za-z0-9]*:.+/.test(param)
