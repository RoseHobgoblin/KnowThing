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
