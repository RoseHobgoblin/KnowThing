import type {
	WikiNode,
	LineToken,
	ListItem,
	DefinitionItem,
	TableRow,
	TableCell
} from './types.js';
import { tokenize } from './lexer.js';
import { parseInline } from './inline.js';

/**
 * Parse raw wikitext into a Document AST node.
 */
export function parse(input: string): WikiNode {
	const tokens = tokenize(input);
	const children = parseTokens(tokens);
	return { type: 'document', children };
}

/**
 * Walk the token stream and build block-level AST nodes.
 */
function parseTokens(tokens: LineToken[]): WikiNode[] {
	const nodes: WikiNode[] = [];
	let i = 0;

	while (i < tokens.length) {
		const token = tokens[i];

		switch (token.type) {
			case 'blank_line':
				i++;
				break;

			case 'heading':
				nodes.push({
					type: 'heading',
					level: token.level,
					children: parseInline(token.content)
				});
				i++;
				break;

			case 'horizontal_rule':
				nodes.push({ type: 'horizontal_rule' });
				i++;
				break;

			case 'preformatted': {
				// Gather contiguous preformatted lines
				let text = '';
				while (i < tokens.length && tokens[i].type === 'preformatted') {
					if (text) text += '\n';
					text += (tokens[i] as { type: 'preformatted'; content: string }).content;
					i++;
				}
				nodes.push({ type: 'preformatted', text });
				break;
			}

			case 'unordered_list_item': {
				const items = collectListItems(tokens, i, 'unordered_list_item');
				nodes.push({ type: 'unordered_list', items: items.items });
				i = items.end;
				break;
			}

			case 'ordered_list_item': {
				const items = collectListItems(tokens, i, 'ordered_list_item');
				nodes.push({ type: 'ordered_list', items: items.items });
				i = items.end;
				break;
			}

			case 'definition_list_item': {
				const items: DefinitionItem[] = [];
				while (i < tokens.length && tokens[i].type === 'definition_list_item') {
					const dt = tokens[i] as { type: 'definition_list_item'; term: string; definition: string };
					items.push({
						term: parseInline(dt.term),
						definition: parseInline(dt.definition)
					});
					i++;
				}
				nodes.push({ type: 'definition_list', items });
				break;
			}

			case 'table_start': {
				const table = parseTable(tokens, i);
				nodes.push(table.node);
				i = table.end;
				break;
			}

			case 'text_line': {
				// Gather contiguous text lines into a paragraph
				const inlineContent: string[] = [];
				while (i < tokens.length && tokens[i].type === 'text_line') {
					inlineContent.push(
						(tokens[i] as { type: 'text_line'; content: string }).content
					);
					i++;
				}
				const text = inlineContent.join(' ');
				const children = parseInline(text);
				// Filter out standalone categories and refs-list from paragraph
				const paraChildren: WikiNode[] = [];
				for (const child of children) {
					if (child.type === 'category') {
						nodes.push(child);
					} else if (child.type === 'reference_list') {
						nodes.push(child);
					} else {
						paraChildren.push(child);
					}
				}
				if (paraChildren.length > 0) {
					nodes.push({ type: 'paragraph', children: paraChildren });
				}
				break;
			}

			// Table tokens outside a table context — skip
			case 'table_end':
			case 'table_row':
			case 'table_header':
			case 'table_cell':
				i++;
				break;

			default:
				i++;
				break;
		}
	}

	return nodes;
}

// ============================================================================
// List item collection
// ============================================================================

function collectListItems(
	tokens: LineToken[],
	start: number,
	itemType: 'unordered_list_item' | 'ordered_list_item'
): { items: ListItem[]; end: number } {
	const items: ListItem[] = [];
	let i = start;

	while (i < tokens.length && tokens[i].type === itemType) {
		const token = tokens[i] as { type: string; depth: number; content: string };
		items.push({ children: parseInline(token.content) });
		i++;
	}

	return { items, end: i };
}

// ============================================================================
// Table parsing
// ============================================================================

function parseTable(
	tokens: LineToken[],
	start: number
): { node: WikiNode; end: number } {
	const startToken = tokens[start] as { type: 'table_start'; attrs: string };
	const attrs = startToken.attrs;
	const rows: TableRow[] = [];
	let currentRow: TableCell[] = [];
	let currentRowAttrs = '';
	let i = start + 1;

	function flushRow() {
		if (currentRow.length > 0) {
			rows.push({ attrs: currentRowAttrs, cells: currentRow });
			currentRow = [];
			currentRowAttrs = '';
		}
	}

	while (i < tokens.length) {
		const token = tokens[i];

		if (token.type === 'table_end') {
			flushRow();
			i++;
			break;
		}

		if (token.type === 'table_row') {
			flushRow();
			currentRowAttrs = token.attrs;
			i++;
			continue;
		}

		if (token.type === 'table_header') {
			// Split on !! for multiple headers
			const cells = splitTableCells(token.content, true);
			currentRow.push(...cells);
			i++;
			continue;
		}

		if (token.type === 'table_cell') {
			// Split on || for multiple cells
			const cells = splitTableCells(token.content, false);
			currentRow.push(...cells);
			i++;
			continue;
		}

		// Nested table
		if (token.type === 'table_start') {
			const nested = parseTable(tokens, i);
			// Embed nested table as a cell child
			if (currentRow.length > 0) {
				currentRow[currentRow.length - 1].children.push(nested.node);
			} else {
				currentRow.push({
					isHeader: false,
					attrs: '',
					children: [nested.node]
				});
			}
			i = nested.end;
			continue;
		}

		// Text/other content inside a table — add to last cell or create implicit cell
		if (token.type === 'text_line') {
			const content = (token as { type: 'text_line'; content: string }).content;
			if (currentRow.length > 0) {
				// Append to last cell
				currentRow[currentRow.length - 1].children.push(
					...parseInline(' ' + content)
				);
			}
			i++;
			continue;
		}

		i++;
	}

	flushRow();
	return { node: { type: 'table', attrs, rows }, end: i };
}

/**
 * Split a header/cell line on !! or || delimiters, handling attrs.
 */
function splitTableCells(content: string, isHeader: boolean): TableCell[] {
	const delimiter = isHeader ? '!!' : '||';
	const parts = splitOnDelimiter(content, delimiter);

	return parts.map((part) => {
		const trimmed = part.trim();
		// Check for inline attrs: "attrs | content"
		// But be careful not to confuse with wikilinks
		const attrMatch = trimmed.match(/^([^|\[\]{}<]*?)\s*\|\s*(.+)$/s);
		if (attrMatch && !attrMatch[1].includes('[[') && !attrMatch[1].includes('{{')) {
			return {
				isHeader,
				attrs: attrMatch[1].trim(),
				children: parseInline(attrMatch[2].trim())
			};
		}
		return {
			isHeader,
			attrs: '',
			children: parseInline(trimmed)
		};
	});
}

/**
 * Split on a delimiter, respecting [[ ]] and {{ }} nesting.
 */
function splitOnDelimiter(input: string, delim: string): string[] {
	const parts: string[] = [];
	let current = '';
	let bracketDepth = 0;
	let braceDepth = 0;

	for (let i = 0; i < input.length; i++) {
		if (input[i] === '[' && input[i + 1] === '[') {
			bracketDepth++;
			current += '[[';
			i++;
		} else if (input[i] === ']' && input[i + 1] === ']') {
			bracketDepth--;
			current += ']]';
			i++;
		} else if (input[i] === '{' && input[i + 1] === '{') {
			braceDepth++;
			current += '{{';
			i++;
		} else if (input[i] === '}' && input[i + 1] === '}') {
			braceDepth--;
			current += '}}';
			i++;
		} else if (
			bracketDepth === 0 &&
			braceDepth === 0 &&
			input.startsWith(delim, i)
		) {
			parts.push(current);
			current = '';
			i += delim.length - 1;
		} else {
			current += input[i];
		}
	}
	parts.push(current);
	return parts;
}
