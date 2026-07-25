/**
 * Convert a title to a wiki-style slug: first letter uppercase, spaces → underscores.
 * Used for /know/ URLs and internal link resolution.
 * e.g. "Aide the Sun" → "Aide_the_Sun"
 */
export function wikiSlugify(title: string): string {
	const cleaned = title
		.trim()
		.normalize('NFC')
		.replaceAll(' ', '_')
		.replaceAll(/[^\p{L}\p{N}_().\-]/gu, '')
	if (!cleaned) return cleaned
	return cleaned[0].toUpperCase() + cleaned.slice(1)
}

/**
 * Convert a name to a URL-friendly slug: lowercase, spaces/special chars → hyphens.
 * Used for /celestial/, /wordbook/, and other domain URLs.
 * e.g. "The Sun" → "the-sun", "Aide the Sun" → "aide-the-sun"
 */
export function urlSlugify(name: string): string {
	return name
		.trim()
		.normalize('NFC')
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}]+/gu, '-')
		.replaceAll(/^-|-$/g, '')
}

// ============================================================================
// Entity-route slug minting — the ONE minting path for entity_routes slugs,
// used by the app's compatibility writers, migrations, merges, and repair
// scripts alike. NFC → slug rules → store → never recompute. The DB CHECK
// (0049, `slug = normalize(slug, NFC)`) is only the backstop.
//
// `boek ≠ bœk` is intentional; unaccent is search-only. Case folding happens
// at the address index (LOWER), never here — slugs keep their minted spelling.
// ============================================================================

export type RouteNamespace = 'know' | 'wordbook' | 'category'

/**
 * Mint the canonical slug for an entity route. Canonical `know` (and
 * `category`) slugs use the wiki convention (`Sun`, `Aide_the_Sun`); the
 * legacy hyphen style (`the-sun`) survives only as noncanonical routes.
 * Wordbook lexeme slugs come from {@link mintLexemeSlug} instead — they carry
 * a homograph suffix.
 */
export function mintEntitySlug(namespace: RouteNamespace, displayName: string): string {
	if (namespace === 'wordbook') return urlSlugify(displayName)
	return wikiSlugify(displayName)
}

/**
 * Mint a language-scoped lexeme route slug: `boek` for the first homograph,
 * `boek-2`, `boek-3`, … for its siblings. One entity per homograph row;
 * stable once minted — a homograph renumbering never rewrites stored slugs.
 */
export function mintLexemeSlug(word: string, homographNumber: number): string {
	const base = urlSlugify(word)
	return homographNumber > 1 ? `${base}-${homographNumber}` : base
}
