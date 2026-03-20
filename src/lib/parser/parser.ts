import type {
	WikiNode,
	LineToken,
	ListItem,
	DefinitionItem,
	TableRow,
	TableCell,
} from './types.js'
import { tokenize } from './lexer.js'
import { parseInline } from './inline.js'

/**
 * Parse raw wikitext into a Document AST node.
 */
export function parse(input: string): WikiNode {
	const tokens = tokenize(input)
	const children = parseTokens(tokens)
	return { type: 'document', children }
}

/**
 * Walk the token stream and build block-level AST nodes.
 */
function parseTokens(tokens: LineToken[]): WikiNode[] {
	const nodes: WikiNode[] = []
	let index = 0

	while (index < tokens.length) {
		const token = tokens[index]

		switch (token.type) {
			case 'blank_line':
				index++
				break

			case 'heading':
				nodes.push({
					type: 'heading',
					level: token.level,
					children: parseInline(token.content),
				})
				index++
				break

			case 'horizontal_rule':
				nodes.push({ type: 'horizontal_rule' })
				index++
				break

			case 'preformatted': {
				// Gather contiguous preformatted lines
				let text = ''
				while (index < tokens.length && tokens[index].type === 'preformatted') {
					if (text) text += '\n'
					text += (tokens[index] as { type: 'preformatted', content: string }).content
					index++
				}
				nodes.push({ type: 'preformatted', text })
				break
			}

			case 'unordered_list_item': {
				const items = collectListItems(tokens, index, 'unordered_list_item')
				nodes.push({ type: 'unordered_list', items: items.items })
				index = items.end
				break
			}

			case 'ordered_list_item': {
				const items = collectListItems(tokens, index, 'ordered_list_item')
				nodes.push({ type: 'ordered_list', items: items.items })
				index = items.end
				break
			}

			case 'definition_list_item': {
				const items: DefinitionItem[] = []
				while (index < tokens.length && tokens[index].type === 'definition_list_item') {
					const dt = tokens[index] as { type: 'definition_list_item', term: string, definition: string }
					items.push({
						term: parseInline(dt.term),
						definition: parseInline(dt.definition),
					})
					index++
				}
				nodes.push({ type: 'definition_list', items })
				break
			}

			case 'table_start': {
				const table = parseTable(tokens, index)
				nodes.push(table.node)
				index = table.end
				break
			}

			case 'text_line': {
				// Gather contiguous text lines into a paragraph
				const inlineContent: string[] = []
				while (index < tokens.length && tokens[index].type === 'text_line') {
					inlineContent.push(
						(tokens[index] as { type: 'text_line', content: string }).content,
					)
					index++
				}
				const text = inlineContent.join(' ')
				const children = parseInline(text)
				// Filter out standalone categories and refs-list from paragraph
				const paraChildren: WikiNode[] = []
				for (const child of children) {
					if (child.type === 'category') {
						nodes.push(child)
					} else if (child.type === 'reference_list') {
						nodes.push(child)
					} else {
						paraChildren.push(child)
					}
				}
				if (paraChildren.length > 0) {
					nodes.push({ type: 'paragraph', children: paraChildren })
				}
				break
			}

			// Table tokens outside a table context — skip
			case 'table_end':
			case 'table_row':
			case 'table_header':
			case 'table_cell':
				index++
				break

			default:
				index++
				break
		}
	}

	return nodes
}

// ============================================================================
// List item collection
// ============================================================================

function collectListItems(
	tokens: LineToken[],
	start: number,
	itemType: 'unordered_list_item' | 'ordered_list_item',
): { items: ListItem[], end: number } {
	const items: ListItem[] = []
	let index = start

	while (index < tokens.length && tokens[index].type === itemType) {
		const token = tokens[index] as { type: string, depth: number, content: string }
		items.push({ children: parseInline(token.content) })
		index++
	}

	return { items, end: index }
}

// ============================================================================
// Table parsing
// ============================================================================

function parseTable(
	tokens: LineToken[],
	start: number,
): { node: WikiNode, end: number } {
	const startToken = tokens[start] as { type: 'table_start', attrs: string }
	const attributes = startToken.attrs
	const rows: TableRow[] = []
	let currentRow: TableCell[] = []
	let currentRowAttributes = ''
	let index = start + 1

	function flushRow() {
		if (currentRow.length > 0) {
			rows.push({ attrs: currentRowAttributes, cells: currentRow })
			currentRow = []
			currentRowAttributes = ''
		}
	}

	while (index < tokens.length) {
		const token = tokens[index]

		if (token.type === 'table_end') {
			flushRow()
			index++
			break
		}

		if (token.type === 'table_row') {
			flushRow()
			currentRowAttributes = token.attrs
			index++
			continue
		}

		if (token.type === 'table_header') {
			// Split on !! for multiple headers
			const cells = splitTableCells(token.content, true)
			currentRow.push(...cells)
			index++
			continue
		}

		if (token.type === 'table_cell') {
			// Split on || for multiple cells
			const cells = splitTableCells(token.content, false)
			currentRow.push(...cells)
			index++
			continue
		}

		// Nested table
		if (token.type === 'table_start') {
			const nested = parseTable(tokens, index)
			// Embed nested table as a cell child
			if (currentRow.length > 0) {
				currentRow.at(-1).children.push(nested.node)
			} else {
				currentRow.push({
					isHeader: false,
					attrs: '',
					children: [nested.node],
				})
			}
			index = nested.end
			continue
		}

		// Text/other content inside a table — add to last cell or create implicit cell
		if (token.type === 'text_line') {
			const content = (token as { type: 'text_line', content: string }).content
			if (currentRow.length > 0) {
				// Append to last cell
				currentRow.at(-1).children.push(
					...parseInline(' ' + content),
				)
			}
			index++
			continue
		}

		index++
	}

	flushRow()
	return { node: { type: 'table', attrs: attributes, rows }, end: index }
}

/**
 * Split a header/cell line on !! or || delimiters, handling attrs.
 */
function splitTableCells(content: string, isHeader: boolean): TableCell[] {
	const delimiter = isHeader ? '!!' : '||'
	const parts = splitOnDelimiter(content, delimiter)

	return parts.map((part) => {
		const trimmed = part.trim()
		// Check for inline attrs: "attrs | content"
		// But be careful not to confuse with wikilinks
		const attributeMatch = trimmed.match(/^([^<[\]{|}]*?)\s*\|\s*(.+)$/s)
		if (attributeMatch && !attributeMatch[1].includes('[[') && !attributeMatch[1].includes('{{')) {
			return {
				isHeader,
				attrs: attributeMatch[1].trim(),
				children: parseInline(attributeMatch[2].trim()),
			}
		}
		return {
			isHeader,
			attrs: '',
			children: parseInline(trimmed),
		}
	})
}

/**
 * Split on a delimiter, respecting [[ ]] and {{ }} nesting.
 */
function splitOnDelimiter(input: string, delim: string): string[] {
	const parts: string[] = []
	let current = ''
	let bracketDepth = 0
	let braceDepth = 0

	for (let index = 0; index < input.length; index++) {
		if (input[index] === '[' && input[index + 1] === '[') {
			bracketDepth++
			current += '[['
			index++
		} else if (input[index] === ']' && input[index + 1] === ']') {
			bracketDepth--
			current += ']]'
			index++
		} else if (input[index] === '{' && input[index + 1] === '{') {
			braceDepth++
			current += '{{'
			index++
		} else if (input[index] === '}' && input[index + 1] === '}') {
			braceDepth--
			current += '}}'
			index++
		} else if (
			bracketDepth === 0 &&
			braceDepth === 0 &&
			input.startsWith(delim, index)
		) {
			parts.push(current)
			current = ''
			index += delim.length - 1
		} else {
			current += input[index]
		}
	}
	parts.push(current)
	return parts
}
