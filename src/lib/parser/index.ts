export { parse as parseWikitext } from './parser.js'
export { parseInline } from './inline.js'
export { tokenize } from './lexer.js'
export {
	extractSummaryFromAst,
	extractSummary,
	extractPlainTextFromAst,
	extractPlainText,
	type SummaryOptions,
} from './summary.js'
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
 *
 * Includes:
 *  - new `namespace_link` nodes (preferred form)
 *  - legacy `domain_link` nodes (still found in cached parsedAst until Phase 9)
 *  - `wordbook_link` nodes (Wordbook is a slash-path section, but its
 *    backlinks need tracking through content_links the same way)
 *
 * Domain naming convention for content_links:
 *   - namespace_link → lowercased namespace key ('rodder', 'category', …)
 *   - wordbook_link  → 'wordbook'; targetSlug is `${language}/${word}` (or
 *                       just `${language}` for language-only links)
 *   - {{wt|word|lang}} templates → 'wordbook' with `${lang}/${word}`, so
 *     inline word mentions get backlink tracking and red-link resolution too
 */
export function extractDomainLinksFromAst(ast: WikiNode): { domain: string, target: string }[] {
	const links: { domain: string, target: string }[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'namespace_link') {
			links.push({ domain: node.namespace.toLowerCase(), target: node.identifier })
		} else if (node.type === 'domain_link') {
			links.push({ domain: node.domain, target: node.target })
		} else if (node.type === 'wordbook_link') {
			const target = node.word ? `${node.language}/${node.word}` : node.language
			links.push({ domain: 'wordbook', target })
		} else if (node.type === 'template' && node.name.toLowerCase().trim() === 'wt') {
			const word = node.args[0]?.value?.trim()
			const lang = node.args[1]?.value?.trim()
			if (word && lang) {
				links.push({ domain: 'wordbook', target: `${lang.toLowerCase()}/${word}` })
			}
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

// Matches a template-argument value that is a bare image filename, e.g.
// "Flag_of_Onchera.svg" or "Coat of arms.png". Whitespace and trailing
// punctuation rule out free-form prose that happens to mention a filename.
const TEMPLATE_IMAGE_VALUE = /^[^\n|]+\.(?:svg|png|jpe?g|gif|webp)$/i

/**
 * Walk a pre-parsed AST and collect all image filenames — both from explicit
 * `[[File:...]]` image nodes and from template arguments whose value looks
 * like an image filename (`image_flag = Foo.svg`, `coat_of_arms = Bar.png`,
 * etc.). The latter is what makes infobox-flag and gallery-template usage
 * show up in `contentMediaUsage`.
 */
export function extractImagesFromAst(ast: WikiNode): string[] {
	const images = new Set<string>()
	walkNodes([ast], (node) => {
		if (node.type === 'image') {
			images.add(node.filename)
		} else if (node.type === 'template') {
			for (const arg of node.args) {
				const value = arg.value.trim()
				if (TEMPLATE_IMAGE_VALUE.test(value)) {
					images.add(value)
				}
			}
		}
	})
	return [...images]
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
 * Image field aliases per infobox subtype, in priority order.
 * Mirrors what the Svelte Infobox* components pass to `getField`, so the card
 * extractor picks the same image the page would render.
 */
const INFOBOX_IMAGE_FIELDS: Record<string, string[]> = {
	country: ['image_flag', 'flag', 'image'],
	former_country: ['image_flag', 'image'],
	settlement: ['image_skyline', 'image'],
	officeholder: ['image', 'smallimage'],
}
const DEFAULT_INFOBOX_IMAGE_FIELDS = ['image']

export function getInfoboxImageFields(subtype: string): string[] {
	return INFOBOX_IMAGE_FIELDS[subtype] ?? DEFAULT_INFOBOX_IMAGE_FIELDS
}

function infoboxSubtypeFromName(name: string): string {
	const match = name.match(/^infobox\s+(.+)$/i)
	return match?.[1]?.trim().toLowerCase().replaceAll(/\s+/g, '_') ?? 'generic'
}

/**
 * Walk a pre-parsed AST and find the first infobox's image field.
 * Returns the literal image arg when one of the subtype's image fields is set;
 * otherwise the `from=` slug + subtype so the caller can look up the image in
 * pre-resolved structured data using the same field-priority list.
 */
export function extractInfoboxImageRef(
	ast: WikiNode,
): { image?: string, fromSlug?: string, subtype?: string } | null {
	let result: { image?: string, fromSlug?: string, subtype?: string } | null = null
	walkNodes([ast], (node) => {
		if (result) return
		if (node.type === 'template' && node.name.toLowerCase().startsWith('infobox')) {
			const subtype = infoboxSubtypeFromName(node.name)
			const fields = getInfoboxImageFields(subtype)
			let image: string | undefined
			for (const field of fields) {
				const value = node.args.find(a => a.name?.toLowerCase().trim() === field)?.value?.trim()
				if (value) {
					image = value
					break
				}
			}
			const fromArg = node.args.find(a => a.name?.toLowerCase().trim() === 'from')?.value?.trim()
			if (image) result = { image }
			else if (fromArg) result = { fromSlug: fromArg, subtype }
		}
	})
	return result
}

/**
 * Walk a pre-parsed AST and find collection-shaped structured-data templates:
 * {{consonants|slug}}, {{vowels|slug}}, {{phonology|slug}}, {{orthography|slug}}.
 * Returns the refs to pre-fetch via resolveAllStructuredCollections.
 *
 * {{phonology|slug}} renders both a consonant and a vowel grid, which read the
 * `consonants:<slug>` and `vowels:<slug>` collections respectively — so it fans
 * out into those two refs rather than a lone `phonology:<slug>` that nothing reads.
 */
const COLLECTION_TEMPLATE_NAMES = new Set(['consonants', 'vowels', 'diphthongs', 'phonology', 'orthography'])

export function extractCollectionRefs(ast: WikiNode): { type: string, slug: string }[] {
	const refs: { type: string, slug: string }[] = []
	walkNodes([ast], (node) => {
		if (node.type === 'template') {
			const name = node.name.toLowerCase().trim()
			if (COLLECTION_TEMPLATE_NAMES.has(name)) {
				const slug = node.args[0]?.value?.trim()
				if (!slug) return
				if (name === 'phonology') {
					refs.push(
						{ type: 'consonants', slug },
						{ type: 'vowels', slug },
						{ type: 'diphthongs', slug },
					)
				} else {
					refs.push({ type: name, slug })
				}
			}
		}
	})
	return refs
}

/**
 * Walk a pre-parsed AST and find {{Root map|slug}} templates.
 * Returns the system slugs to pre-fetch.
 */
export function extractRootMapRefs(ast: WikiNode): string[] {
	return extractRodderDisplayRefs(ast).filter(ref => ref.kind === 'root').map(ref => ref.slug)
}

export type RodderDisplayReference = { kind: 'root' | 'sector', slug: string }

/** Discover Rodder display targets without interpreting their presentation arguments. */
export function extractRodderDisplayRefs(ast: WikiNode): RodderDisplayReference[] {
	const references: RodderDisplayReference[] = []
	walkNodes([ast], (node) => {
		if (node.type !== 'template') return
		const name = node.name.toLowerCase().trim()
		if (name !== 'root map' && name !== 'sector map') return
		const slug = node.args.find(argument => !argument.name)?.value.trim()
		if (slug) references.push({ kind: name === 'root map' ? 'root' : 'sector', slug })
	})
	return references
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
		case 'namespace_link':
		case 'wordbook_link':
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
