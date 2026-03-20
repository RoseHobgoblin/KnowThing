import type { TemplateArg } from './types.js'

const MAX_EXPANSION_DEPTH = 10

/**
 * Substitute template parameters in source text.
 * Handles {{{name}}}, {{{name|default}}}, and positional {{{1}}}, {{{2}}}, etc.
 */
export function substituteParams(source: string, args: TemplateArg[]): string {
	// Build param map: named params + positional (1-indexed)
	const params = new Map<string, string>()
	let positional = 0

	for (const argument of args) {
		if (argument.name) {
			params.set(argument.name.trim().toLowerCase(), argument.value)
		} else {
			positional++
			params.set(String(positional), argument.value)
		}
	}

	// Replace {{{param}}} and {{{param|default}}}
	return replaceTripleBraces(source, params)
}

function replaceTripleBraces(source: string, params: Map<string, string>): string {
	let result = ''
	let index = 0

	while (index < source.length) {
		// Look for {{{
		if (
			index + 2 < source.length &&
			source[index] === '{' &&
			source[index + 1] === '{' &&
			source[index + 2] === '{'
		) {
			// Find matching }}}
			let depth = 1
			let index_ = index + 3

			while (index_ < source.length && depth > 0) {
				if (
					index_ + 2 < source.length &&
					source[index_] === '{' &&
					source[index_ + 1] === '{' &&
					source[index_ + 2] === '{'
				) {
					depth++
					index_ += 3
				} else if (
					index_ + 2 < source.length &&
					source[index_] === '}' &&
					source[index_ + 1] === '}' &&
					source[index_ + 2] === '}'
				) {
					depth--
					if (depth === 0) break
					index_ += 3
				} else {
					index_++
				}
			}

			if (depth === 0) {
				const inner = source.slice(index + 3, index_)
				// Split on first | for default value
				const pipeIndex = inner.indexOf('|')
				let paramName: string
				let defaultValue: string

				if (pipeIndex === -1) {
					paramName = inner.trim().toLowerCase()
					defaultValue = ''
				} else {
					paramName = inner.slice(0, pipeIndex).trim().toLowerCase()
					defaultValue = inner.slice(pipeIndex + 1)
				}

				const value = params.get(paramName)
				result += value === undefined ? defaultValue : value
				index = index_ + 3
				continue
			}
		}

		result += source[index]
		index++
	}

	return result
}

/**
 * Process include/exclude tags for template transclusion.
 *
 * When transcluding (embedding template in another page):
 * - <onlyinclude>: if present, ONLY that content is used
 * - <noinclude>: stripped entirely
 * - <includeonly>: unwrapped (tags removed, content kept)
 *
 * When viewing directly (template page itself):
 * - <includeonly>: stripped entirely
 * - <noinclude>: unwrapped
 * - <onlyinclude>: unwrapped
 */
export function processIncludeTags(source: string, isTranscluding: boolean): string {
	if (isTranscluding) {
		// Check for <onlyinclude> — if present, extract only that content
		const onlyIncludeRegex = /<onlyinclude>([\S\s]*?)<\/onlyinclude>/gi
		const onlyMatches = [...source.matchAll(onlyIncludeRegex)]
		if (onlyMatches.length > 0) {
			return onlyMatches.map(m => m[1]).join('')
		}

		// Strip <noinclude>...</noinclude>
		let result = source.replaceAll(/<noinclude>[\S\s]*?<\/noinclude>/gi, '')
		// Unwrap <includeonly>...</includeonly>
		result = result.replaceAll(/<\/?includeonly>/gi, '')
		return result
	} else {
		// Strip <includeonly>...</includeonly>
		let result = source.replaceAll(/<includeonly>[\S\s]*?<\/includeonly>/gi, '')
		// Unwrap <noinclude> and <onlyinclude>
		result = result.replaceAll(/<\/?noinclude>/gi, '')
		result = result.replaceAll(/<\/?onlyinclude>/gi, '')
		return result
	}
}

/**
 * Expand a template: substitute params and process include tags.
 * Used by the server-side render pipeline for DB-stored templates.
 */
export function expandTemplate(
	templateSource: string,
	args: TemplateArg[],
	depth: number = 0,
): string {
	if (depth >= MAX_EXPANSION_DEPTH) {
		return '{{Template expansion depth exceeded}}'
	}

	const processed = processIncludeTags(templateSource, true)
	return substituteParams(processed, args)
}
