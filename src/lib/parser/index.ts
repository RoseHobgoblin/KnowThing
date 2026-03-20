export { parse as parseWikitext } from './parser.js'
export { parseInline } from './inline.js'
export { tokenize } from './lexer.js'
export type * from './types.js'

import type { WikiNode } from './types.js'
import { parse } from './parser.js'

/**
 * Walk the AST and collect all internal link targets.
 */
export function extractLinks(input: string): string[] {
	const ast = parse(input)
	const links: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'internal_link') {
			links.push(node.target)
		}
	})
	return links
}

/**
 * Walk the AST and collect all category names.
 */
export function extractCategories(input: string): string[] {
	const ast = parse(input)
	const cats: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'category') {
			cats.push(node.name)
		}
	})
	return cats
}

/**
 * Walk the AST and collect all image filenames.
 */
export function extractImages(input: string): string[] {
	const ast = parse(input)
	const images: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'image') {
			images.push(node.filename)
		}
	})
	return images
}

/**
 * Strip wiki markup to plain text (for FTS indexing).
 */
export function stripMarkup(input: string): string {
	return input
		// Remove HTML tags
		.replaceAll(/<[^>]+>/g, '')
		// Remove templates {{...}} (non-greedy, nested braces not handled — good enough for FTS)
		.replaceAll(/{{[^}]*}}/g, '')
		// Remove category/file links
		.replaceAll(/\[\[(category|file|image):[^\]]*]]/gi, '')
		// Convert internal links to display text
		.replaceAll(/\[\[([^\]|]*\|)?([^\]]*)]]/g, '$2')
		// Remove external link brackets
		.replaceAll(/\[(https?:\/\/\S+)\s*([^\]]*)]/g, '$2')
		// Remove wiki formatting
		.replaceAll(/'{2,5}/g, '')
		.replaceAll(/~~([^~]+)~~/g, '$1')
		// Remove heading markers
		.replaceAll(/^={2,6}\s*(.+?)\s*={2,6}\s*$/gm, '$1')
		// Remove table syntax
		.replaceAll(/^[!{|]-?.*$/gm, '')
		// Remove list markers
		.replaceAll(/^[#*:;]+\s*/gm, '')
		// Collapse whitespace
		.replaceAll(/\s+/g, ' ')
		.trim()
}

// ============================================================================
// AST walker
// ============================================================================

function walkNodes(nodes: WikiNode[], visitor: (node: WikiNode) => void): void {
	for (const node of nodes) {
		visitor(node)
		const children = getChildren(node)
		if (children.length > 0) {
			walkNodes(children, visitor)
		}
	}
}

function getChildren(node: WikiNode): WikiNode[] {
	switch (node.type) {
		case 'document':
		case 'paragraph':
		case 'bold':
		case 'italic':
		case 'strikethrough':
		case 'subscript':
		case 'superscript':
			return node.children
		case 'heading':
			return node.children
		case 'hatnote':
			return node.content
		case 'collapse':
			return node.content
		case 'reference':
			return node.content
		case 'unordered_list':
		case 'ordered_list':
			return node.items.flatMap(item => item.children)
		case 'definition_list':
			return node.items.flatMap(item => [...item.term, ...item.definition])
		case 'internal_link':
			return node.display || []
		case 'table':
			return node.rows.flatMap(row => row.cells.flatMap(cell => cell.children))
		case 'navbox':
			return node.groups.flatMap(group => group.items)
		default:
			return []
	}
}
