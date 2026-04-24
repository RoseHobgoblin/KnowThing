export { parse as parseWikitext } from './parser.js'
export { parseInline } from './inline.js'
export { tokenize } from './lexer.js'
export type * from './types.js'

import type { WikiNode } from './types.js'
import { parse } from './parser.js'
import { parseInline } from './inline.js'

// ============================================================================
// AST-based extractors (accept a pre-parsed AST)
// ============================================================================

/**
 * Walk a pre-parsed AST and collect all internal link targets.
 */
export function extractLinksFromAst(ast: WikiNode): string[] {
	const links: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'internal_link') {
			links.push(node.target)
		}
	})
	return links
}

/**
 * Walk a pre-parsed AST and collect all cross-domain link targets.
 */
export function extractDomainLinksFromAst(ast: WikiNode): { domain: string, target: string }[] {
	const links: { domain: string, target: string }[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'domain_link') {
			links.push({ domain: node.domain, target: node.target })
		}
	})
	return links
}

/**
 * Walk a pre-parsed AST and collect all category names.
 */
export function extractCategoriesFromAst(ast: WikiNode): string[] {
	const cats: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'category') {
			cats.push(node.name)
		}
	})
	return cats
}

/**
 * Walk a pre-parsed AST and collect all image filenames.
 */
export function extractImagesFromAst(ast: WikiNode): string[] {
	const images: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'image') {
			images.push(node.filename)
		}
	})
	return images
}

// ============================================================================
// Convenience wrappers (parse from raw wikitext)
// ============================================================================

export function extractLinks(input: string): string[] {
	return extractLinksFromAst(parse(input))
}

export function extractCategories(input: string): string[] {
	return extractCategoriesFromAst(parse(input))
}

export function extractImages(input: string): string[] {
	return extractImagesFromAst(parse(input))
}

/**
 * Walk a pre-parsed AST and find infobox templates with a `from=slug` argument.
 * Returns the infobox subtype and the slug to resolve.
 */
export function extractInfoboxFromRefs(ast: WikiNode): { type: string, slug: string }[] {
	const refs: { type: string, slug: string }[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'template' && node.name.toLowerCase().startsWith('infobox')) {
			const fromArg = node.args.find(a => a.name?.toLowerCase().trim() === 'from')
			if (fromArg?.value) {
				const match = node.name.match(/^infobox\s+(.+)$/i)
				const subtype = match?.[1]?.trim().toLowerCase() ?? 'generic'
				refs.push({ type: subtype, slug: fromArg.value.trim() })
			}
		}
	})
	return refs
}

/**
 * Walk a pre-parsed AST and find the first infobox's `image` field.
 * Returns the literal `image=` arg when set; otherwise the `from=` slug so the
 * caller can look it up in pre-resolved structured data.
 */
export function extractInfoboxImageRef(ast: WikiNode): { image?: string, fromSlug?: string } | null {
	let result: { image?: string, fromSlug?: string } | null = null
	walkNodes([ast], (node) => {
		if (result) return
		if (node.type === 'template' && node.name.toLowerCase().startsWith('infobox')) {
			const imageArg = node.args.find(a => a.name?.toLowerCase().trim() === 'image')?.value?.trim()
			const fromArg = node.args.find(a => a.name?.toLowerCase().trim() === 'from')?.value?.trim()
			if (imageArg) result = { image: imageArg }
			else if (fromArg) result = { fromSlug: fromArg }
		}
	})
	return result
}

/**
 * Walk a pre-parsed AST and find collection-shaped structured-data templates:
 * {{consonants|slug}}, {{vowels|slug}}, {{phonology|slug}}.
 * Returns the refs to pre-fetch via resolveAllStructuredCollections.
 */
const COLLECTION_TEMPLATE_NAMES = new Set(['consonants', 'vowels', 'phonology'])

export function extractCollectionRefs(ast: WikiNode): { type: string, slug: string }[] {
	const refs: { type: string, slug: string }[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'template') {
			const name = node.name.toLowerCase().trim()
			if (COLLECTION_TEMPLATE_NAMES.has(name)) {
				const slug = node.args[0]?.value?.trim()
				if (slug) refs.push({ type: name, slug })
			}
		}
	})
	return refs
}

/**
 * Walk a pre-parsed AST and find {{System map|slug}} templates.
 * Returns the system slugs to pre-fetch.
 */
export function extractSystemMapRefs(ast: WikiNode): string[] {
	const slugs: string[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'template' && node.name.toLowerCase().trim() === 'system map') {
			const slug = node.args[0]?.value?.trim()
			if (slug) slugs.push(slug)
		}
	})
	return slugs
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
		case 'domain_link':
			return node.display || []
		case 'table':
			return node.rows.flatMap(row => row.cells.flatMap(cell => cell.children))
		case 'navbox':
			return node.groups.flatMap(group => group.items)
		case 'template':
			// Template args store raw wikitext strings — parse them to find links inside
			return node.args.flatMap(arg => arg.value ? parseInline(arg.value) : [])
		default:
			return []
	}
}
