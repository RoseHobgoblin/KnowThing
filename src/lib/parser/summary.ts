import type { WikiNode } from './types.js'
import { parse } from './parser.js'

export interface SummaryOptions {
	maxLength?: number
}

export function extractSummaryFromAst(ast: WikiNode, options?: SummaryOptions): string {
	if (ast.type !== 'document') return ''

	for (const child of ast.children) {
		if (child.type !== 'paragraph') continue
		const text = collapseWhitespace(flattenInline(child.children))
		if (text.length === 0) continue
		return truncate(text, options?.maxLength)
	}
	return ''
}

export function extractSummary(wikitext: string, options?: SummaryOptions): string {
	return extractSummaryFromAst(parse(wikitext), options)
}

function flattenInline(nodes: WikiNode[]): string {
	let out = ''
	for (const node of nodes) {
		switch (node.type) {
			case 'text':
				out += node.text
				break
			case 'bold':
			case 'italic':
			case 'strikethrough':
			case 'subscript':
			case 'superscript':
				out += flattenInline(node.children)
				break
			case 'internal_link':
			case 'domain_link': {
				const display = node.display && node.display.length > 0
					? flattenInline(node.display)
					: ''
				out += display.length > 0 ? display : node.target
				break
			}
			case 'wordbook_link': {
				const display = node.display && node.display.length > 0
					? flattenInline(node.display)
					: ''
				out += display.length > 0 ? display : node.word
				break
			}
			case 'external_link':
				out += node.display ?? node.url
				break
			case 'nowiki':
				out += node.text
				break
			case 'line_break':
				out += ' '
				break
			// Skipped: reference, template, image, gallery, anything else
		}
	}
	return out
}

function collapseWhitespace(input: string): string {
	return input.replaceAll(/\s+/g, ' ').trim()
}

function truncate(input: string, maxLength: number | undefined): string {
	if (maxLength === undefined || input.length <= maxLength) return input
	const window = input.slice(0, maxLength)
	const lastSpace = window.lastIndexOf(' ')
	const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window
	return `${cut.trimEnd()}…`
}
