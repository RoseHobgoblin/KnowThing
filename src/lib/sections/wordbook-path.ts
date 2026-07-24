// ============================================================================
// Wordbook section path parsing
//
// Wordbook is a slash-path section, not a colon-namespace. URLs are:
//   /Wordbook/Oncheran            language landing page
//   /Wordbook/Oncheran/Makala     individual word page
//
// Wikilinks: [[Wordbook/Oncheran/Makala]]
// Embeds:    {{Wordbook/Oncheran/Makala}}
//
// The legacy [[wb:lang:word]] form is parsed separately and emits the same
// `wordbook_link` AST node.
// ============================================================================

export interface WordbookPath {
	language: string
	word?: string
}

/**
 * Parse a target string for the Wordbook section. Accepts:
 *   "Wordbook/Oncheran"
 *   "Wordbook/Oncheran/Makala"
 * Case-insensitive on the "Wordbook" prefix; preserves case on language and
 * word identifiers (the slug normalization happens at lookup time).
 *
 * Returns null if the target doesn't begin with the Wordbook prefix.
 */
export function parseWordbookPath(target: string): WordbookPath | null {
	const slashIndex = target.indexOf('/')
	if (slashIndex === -1) return null
	const prefix = target.slice(0, slashIndex)
	if (prefix.toLowerCase() !== 'wordbook') return null

	const rest = target.slice(slashIndex + 1)
	if (!rest) return null

	const nextSlash = rest.indexOf('/')
	if (nextSlash === -1) {
		return { language: rest }
	}
	const language = rest.slice(0, nextSlash)
	const word = rest.slice(nextSlash + 1)
	if (!language) return null
	return word ? { language, word } : { language }
}

export function buildWordbookHref(path: WordbookPath): string {
	if (path.word) {
		return `/Wordbook/${encodeURIComponent(path.language)}/${encodeURIComponent(path.word)}`
	}
	return `/Wordbook/${encodeURIComponent(path.language)}`
}
