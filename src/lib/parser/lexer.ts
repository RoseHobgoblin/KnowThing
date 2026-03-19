import type { LineToken } from './types.js';

/**
 * Pre-process: join multi-line templates into single logical lines.
 * Templates like {{Infobox country\n|capital=...}} span multiple lines.
 * We need to join them so the `|` inside doesn't get mistaken for table syntax.
 */
function joinMultilineTemplates(input: string): string {
	const lines = input.split('\n');
	const result: string[] = [];
	let buffer = '';
	let depth = 0;

	for (const line of lines) {
		if (depth > 0) {
			buffer += '\n' + line;
		} else {
			buffer = line;
		}

		// Count braces in this line
		for (let i = 0; i < line.length; i++) {
			if (line[i] === '{' && i + 1 < line.length && line[i + 1] === '{') {
				depth++;
				i++; // skip next {
			} else if (line[i] === '}' && i + 1 < line.length && line[i + 1] === '}') {
				depth--;
				if (depth < 0) depth = 0;
				i++; // skip next }
			}
		}

		if (depth === 0) {
			// Replace internal newlines with spaces so multi-line templates become one logical line
			result.push(buffer.replace(/\n/g, ' '));
			buffer = '';
		}
	}

	// If unclosed template, emit remaining lines individually
	if (buffer) {
		result.push(...buffer.split('\n'));
	}

	return result.join('\n');
}

/**
 * Tokenize a single line into a LineToken.
 */
function tokenizeLine(line: string): LineToken {
	// Blank line
	if (line.trim() === '') {
		return { type: 'blank_line' };
	}

	// Horizontal rule: 4+ dashes
	if (/^-{4,}\s*$/.test(line)) {
		return { type: 'horizontal_rule' };
	}

	// Heading: == text == (level 2–6)
	const headingMatch = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
	if (headingMatch) {
		return {
			type: 'heading',
			level: headingMatch[1].length,
			content: headingMatch[2]
		};
	}

	// Table start: {| optional attrs
	if (line.startsWith('{|')) {
		return { type: 'table_start', attrs: line.slice(2).trim() };
	}

	// Table end: |}
	if (line.startsWith('|}')) {
		return { type: 'table_end' };
	}

	// Table row: |- optional attrs
	if (line.startsWith('|-')) {
		return { type: 'table_row', attrs: line.slice(2).trim() };
	}

	// Table header: ! content
	if (line.startsWith('!')) {
		return { type: 'table_header', content: line.slice(1).trim() };
	}

	// Table cell: | content (but not || which is handled inline)
	// Must not match |} or |- which are already handled
	if (line.startsWith('|') && !line.startsWith('|}') && !line.startsWith('|-') && !line.startsWith('{|')) {
		return { type: 'table_cell', content: line.slice(1).trim() };
	}

	// Definition list: ; term : definition
	if (line.startsWith(';')) {
		const rest = line.slice(1);
		// Find the first ':' that separates term from definition
		// but be careful of links [[...]] which contain colons
		let bracketDepth = 0;
		let splitIdx = -1;
		for (let i = 0; i < rest.length; i++) {
			if (rest[i] === '[' && i + 1 < rest.length && rest[i + 1] === '[') {
				bracketDepth++;
				i++;
			} else if (rest[i] === ']' && i + 1 < rest.length && rest[i + 1] === ']') {
				bracketDepth--;
				i++;
			} else if (rest[i] === ':' && bracketDepth === 0) {
				splitIdx = i;
				break;
			}
		}
		if (splitIdx >= 0) {
			return {
				type: 'definition_list_item',
				term: rest.slice(0, splitIdx).trim(),
				definition: rest.slice(splitIdx + 1).trim()
			};
		}
		// No definition part — treat term as the full content
		return {
			type: 'definition_list_item',
			term: rest.trim(),
			definition: ''
		};
	}

	// Unordered list: * item (depth = number of *)
	const ulMatch = line.match(/^(\*+)\s*(.*)/);
	if (ulMatch) {
		return {
			type: 'unordered_list_item',
			depth: ulMatch[1].length,
			content: ulMatch[2]
		};
	}

	// Ordered list: # item (depth = number of #)
	const olMatch = line.match(/^(#+)\s*(.*)/);
	if (olMatch) {
		return {
			type: 'ordered_list_item',
			depth: olMatch[1].length,
			content: olMatch[2]
		};
	}

	// Preformatted: line starts with a space
	if (line.startsWith(' ')) {
		return { type: 'preformatted', content: line.slice(1) };
	}

	// Default: text line
	return { type: 'text_line', content: line };
}

/**
 * Tokenize raw wikitext into a stream of LineTokens.
 */
export function tokenize(input: string): LineToken[] {
	const preprocessed = joinMultilineTemplates(input);
	return preprocessed.split('\n').map(tokenizeLine);
}
