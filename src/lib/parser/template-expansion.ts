import type { TemplateArg } from './types.js';

const MAX_EXPANSION_DEPTH = 10;

/**
 * Substitute template parameters in source text.
 * Handles {{{name}}}, {{{name|default}}}, and positional {{{1}}}, {{{2}}}, etc.
 */
export function substituteParams(source: string, args: TemplateArg[]): string {
	// Build param map: named params + positional (1-indexed)
	const params = new Map<string, string>();
	let positional = 0;

	for (const arg of args) {
		if (arg.name) {
			params.set(arg.name.trim().toLowerCase(), arg.value);
		} else {
			positional++;
			params.set(String(positional), arg.value);
		}
	}

	// Replace {{{param}}} and {{{param|default}}}
	return replaceTripleBraces(source, params);
}

function replaceTripleBraces(source: string, params: Map<string, string>): string {
	let result = '';
	let i = 0;

	while (i < source.length) {
		// Look for {{{
		if (
			i + 2 < source.length &&
			source[i] === '{' &&
			source[i + 1] === '{' &&
			source[i + 2] === '{'
		) {
			// Find matching }}}
			let depth = 1;
			let j = i + 3;

			while (j < source.length && depth > 0) {
				if (
					j + 2 < source.length &&
					source[j] === '{' &&
					source[j + 1] === '{' &&
					source[j + 2] === '{'
				) {
					depth++;
					j += 3;
				} else if (
					j + 2 < source.length &&
					source[j] === '}' &&
					source[j + 1] === '}' &&
					source[j + 2] === '}'
				) {
					depth--;
					if (depth === 0) break;
					j += 3;
				} else {
					j++;
				}
			}

			if (depth === 0) {
				const inner = source.slice(i + 3, j);
				// Split on first | for default value
				const pipeIdx = inner.indexOf('|');
				let paramName: string;
				let defaultValue: string;

				if (pipeIdx >= 0) {
					paramName = inner.slice(0, pipeIdx).trim().toLowerCase();
					defaultValue = inner.slice(pipeIdx + 1);
				} else {
					paramName = inner.trim().toLowerCase();
					defaultValue = '';
				}

				const value = params.get(paramName);
				result += value !== undefined ? value : defaultValue;
				i = j + 3;
				continue;
			}
		}

		result += source[i];
		i++;
	}

	return result;
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
		const onlyIncludeRegex = /<onlyinclude>([\s\S]*?)<\/onlyinclude>/gi;
		const onlyMatches = [...source.matchAll(onlyIncludeRegex)];
		if (onlyMatches.length > 0) {
			return onlyMatches.map((m) => m[1]).join('');
		}

		// Strip <noinclude>...</noinclude>
		let result = source.replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, '');
		// Unwrap <includeonly>...</includeonly>
		result = result.replace(/<\/?includeonly>/gi, '');
		return result;
	} else {
		// Strip <includeonly>...</includeonly>
		let result = source.replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, '');
		// Unwrap <noinclude> and <onlyinclude>
		result = result.replace(/<\/?noinclude>/gi, '');
		result = result.replace(/<\/?onlyinclude>/gi, '');
		return result;
	}
}

/**
 * Expand a template: substitute params and process include tags.
 * Used by the server-side render pipeline for DB-stored templates.
 */
export function expandTemplate(
	templateSource: string,
	args: TemplateArg[],
	depth: number = 0
): string {
	if (depth >= MAX_EXPANSION_DEPTH) {
		return '{{Template expansion depth exceeded}}';
	}

	const processed = processIncludeTags(templateSource, true);
	return substituteParams(processed, args);
}
