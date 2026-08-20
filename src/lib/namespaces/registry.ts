// ============================================================================
// Namespace registry
//
// Structured-entity URLs follow MediaWiki convention: /Namespace:Identifier.
// Wordbook is NOT a namespace — it's a slash-path section (see ../sections/
// wordbook-path.ts). Know articles live bare at /know/[slug] (default
// namespace).
// ============================================================================

export const NAMESPACE_KEYS = [
	'Rodder',
	'Calendar',
	'Category',
	'Country',
	'Map',
	'CarveCraft',
	'Template',
	'File',
	'Image',
	'Special',
] as const

export type NamespaceKey = typeof NAMESPACE_KEYS[number]

const CANONICAL_BY_LOWER: Map<string, NamespaceKey> = new Map(
	NAMESPACE_KEYS.map(k => [k.toLowerCase(), k]),
)

export function canonicalizeNamespace(input: string): NamespaceKey | null {
	return CANONICAL_BY_LOWER.get(input.toLowerCase()) ?? null
}

export function isNamespacePrefix(token: string): boolean {
	return canonicalizeNamespace(token) !== null
}

/**
 * Split a `Namespace:Identifier` target into its parts. The identifier may
 * itself contain `:` or `/` (e.g. `Wordbook` doesn't go through here, but
 * `Category:Foo/Bar` does — `/Bar` is a subpage).
 *
 * Returns null if the prefix is not a registered namespace.
 */
export function splitNamespaceTarget(target: string): { ns: NamespaceKey, identifier: string } | null {
	const colon = target.indexOf(':')
	if (colon <= 0) return null
	const prefix = target.slice(0, colon)
	const ns = canonicalizeNamespace(prefix)
	if (!ns) return null
	const identifier = target.slice(colon + 1)
	if (!identifier) return null
	return { ns, identifier }
}
