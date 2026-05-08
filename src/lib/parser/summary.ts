import type { WikiNode } from './types.js'
import { parse } from './parser.js'

export interface SummaryOptions {
	maxLength?: number
}

const ELLIPSIS = '\u2026'

export function extractSummaryFromAst(ast: WikiNode, options?: SummaryOptions): string {
	if (ast.type !== 'document') return ''

	for (const child of ast.children) {
		if (child.type !== 'paragraph') continue
		const text = collapseWhitespace(nodeToText(child))
		if (text.length === 0) continue
		return truncate(text, options?.maxLength)
	}
	return ''
}

export function extractSummary(wikitext: string, options?: SummaryOptions): string {
	return extractSummaryFromAst(parse(wikitext), options)
}

/**
 * Walk an AST and produce all user-facing prose as a single plain-text string.
 * Skips infobox/block templates, categories, files, navboxes, code blocks, and
 * other non-prose scaffolding. This is the indexing-side counterpart to
 * extractSummaryFromAst — they share flattening rules so search snippets
 * (ts_headline) and card/preview summaries describe the same article in the
 * same shape.
 */
export function extractPlainTextFromAst(ast: WikiNode): string {
	return collapseWhitespace(nodeToText(ast))
}

export function extractPlainText(wikitext: string): string {
	return extractPlainTextFromAst(parse(wikitext))
}

function nodeToText(node: WikiNode): string {
	switch (node.type) {
		case 'document':
			return node.children.map(nodeToText).join(' ')

		// Block prose
		case 'paragraph':
		case 'heading':
		case 'bold':
		case 'italic':
		case 'strikethrough':
		case 'subscript':
		case 'superscript':
			return node.children.map(nodeToText).join('')
		case 'unordered_list':
		case 'ordered_list':
			return node.items.map(item => item.children.map(nodeToText).join('')).join(' ')
		case 'definition_list':
			return node.items.map(item =>
				`${item.term.map(nodeToText).join('')} ${item.definition.map(nodeToText).join('')}`,
			).join(' ')
		case 'table':
			return node.rows.map(row =>
				row.cells.map(cell => cell.children.map(nodeToText).join('')).join(' '),
			).join(' ')
		case 'collapse':
		case 'hatnote':
			return node.content.map(nodeToText).join(' ')

		// Inline
		case 'text':
		case 'nowiki':
			return node.text
		case 'line_break':
			return ' '
		case 'internal_link':
		case 'domain_link': {
			const display = node.display && node.display.length > 0
				? node.display.map(nodeToText).join('')
				: ''
			return display.length > 0 ? display : node.target
		}
		case 'namespace_link': {
			const display = node.display && node.display.length > 0
				? node.display.map(nodeToText).join('')
				: ''
			return display.length > 0 ? display : node.identifier
		}
		case 'wordbook_link': {
			const display = node.display && node.display.length > 0
				? node.display.map(nodeToText).join('')
				: ''
			return display.length > 0 ? display : (node.word || node.language)
		}
		case 'external_link':
			return node.display ?? node.url

		// Skipped (non-prose scaffolding)
		case 'reference':
		case 'template':
		case 'image':
		case 'gallery':
		case 'category':
		case 'navbox':
		case 'code_block':
		case 'reference_list':
		case 'horizontal_rule':
		case 'preformatted':
			return ''
	}
}

function collapseWhitespace(input: string): string {
	return input.replaceAll(/\s+/g, ' ').trim()
}

function truncate(input: string, maxLength: number | undefined): string {
	if (maxLength === undefined || input.length <= maxLength) return input
	const window = input.slice(0, maxLength)
	const lastSpace = window.lastIndexOf(' ')
	const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window
	return `${cut.trimEnd()}${ELLIPSIS}`
}
