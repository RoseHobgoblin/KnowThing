// ============================================================================
// WikiNode AST — discriminated union for parsed wikitext
// ============================================================================

export type WikiNode =
	| DocumentNode
	| HeadingNode
	| ParagraphNode
	| BoldNode
	| ItalicNode
	| StrikethroughNode
	| SubscriptNode
	| SuperscriptNode
	| UnorderedListNode
	| OrderedListNode
	| DefinitionListNode
	| InternalLinkNode
	| WordbookLinkNode
	| DomainLinkNode
	| ExternalLinkNode
	| TemplateNode
	| ImageNode
	| TableNode
	| CategoryNode
	| ReferenceNode
	| ReferenceListNode
	| HatnoteNode
	| CollapseNode
	| CodeBlockNode
	| NavboxNode
	| GalleryNode
	| NoWikiNode
	| HorizontalRuleNode
	| PreformattedNode
	| TextNode
	| LineBreakNode

// Block-level nodes
export interface DocumentNode {
	type: 'document'
	children: WikiNode[]
}
export interface HeadingNode {
	type: 'heading'
	level: number // 2–6
	children: WikiNode[]
}
export interface ParagraphNode {
	type: 'paragraph'
	children: WikiNode[]
}
export interface UnorderedListNode {
	type: 'unordered_list'
	items: ListItem[]
}
export interface OrderedListNode {
	type: 'ordered_list'
	items: ListItem[]
}
export interface DefinitionListNode {
	type: 'definition_list'
	items: DefinitionItem[]
}
export interface TableNode {
	type: 'table'
	attrs: string
	rows: TableRow[]
}
export interface PreformattedNode {
	type: 'preformatted'
	text: string
}
export interface HorizontalRuleNode {
	type: 'horizontal_rule'
}

// Inline formatting
export interface BoldNode {
	type: 'bold'
	children: WikiNode[]
}
export interface ItalicNode {
	type: 'italic'
	children: WikiNode[]
}
export interface StrikethroughNode {
	type: 'strikethrough'
	children: WikiNode[]
}
export interface SubscriptNode {
	type: 'subscript'
	children: WikiNode[]
}
export interface SuperscriptNode {
	type: 'superscript'
	children: WikiNode[]
}

// Links
export interface InternalLinkNode {
	type: 'internal_link'
	target: string
	display: WikiNode[] | null
}
export interface WordbookLinkNode {
	type: 'wordbook_link'
	language: string
	word: string
	display: WikiNode[] | null
}
export interface DomainLinkNode {
	type: 'domain_link'
	domain: string
	target: string
	display: WikiNode[] | null
}
export interface ExternalLinkNode {
	type: 'external_link'
	url: string
	display: string | null
}

// Templates & transclusion
export interface TemplateNode {
	type: 'template'
	name: string
	args: TemplateArg[]
}

// Media
export interface ImageNode {
	type: 'image'
	filename: string
	options: ImageOption[]
}
export interface GalleryNode {
	type: 'gallery'
	items: GalleryItem[]
}

// Metadata
export interface CategoryNode {
	type: 'category'
	name: string
}

// References
export interface ReferenceNode {
	type: 'reference'
	content: WikiNode[]
}
export interface ReferenceListNode {
	type: 'reference_list'
}

// Special blocks
export interface HatnoteNode {
	type: 'hatnote'
	content: WikiNode[]
}
export interface CollapseNode {
	type: 'collapse'
	title: string
	content: WikiNode[]
}
export interface CodeBlockNode {
	type: 'code_block'
	lang: string | null
	code: string
}
export interface NavboxNode {
	type: 'navbox'
	title: string
	groups: NavboxGroup[]
}

// Inline misc
export interface NoWikiNode {
	type: 'nowiki'
	text: string
}
export interface TextNode {
	type: 'text'
	text: string
}
export interface LineBreakNode {
	type: 'line_break'
}

// ============================================================================
// Supporting types
// ============================================================================

export interface ListItem {
	children: WikiNode[]
}

export interface DefinitionItem {
	term: WikiNode[]
	definition: WikiNode[]
}

export interface TemplateArg {
	name: string | null
	value: string
}

export interface TableRow {
	attrs: string
	cells: TableCell[]
}

export interface TableCell {
	isHeader: boolean
	attrs: string
	children: WikiNode[]
}

export interface NavboxGroup {
	name: string
	items: WikiNode[]
}

export interface GalleryItem {
	filename: string
	caption: string
}

export type ImageOption =
	| { type: 'thumb' }
	| { type: 'frame' }
	| { type: 'frameless' }
	| { type: 'right' }
	| { type: 'left' }
	| { type: 'center' }
	| { type: 'width', value: number }
	| { type: 'caption', text: string }
	| { type: 'alt', text: string }

// ============================================================================
// Lexer token types (line-based)
// ============================================================================

export type LineToken =
	| { type: 'heading', level: number, content: string }
	| { type: 'unordered_list_item', depth: number, content: string }
	| { type: 'ordered_list_item', depth: number, content: string }
	| { type: 'horizontal_rule' }
	| { type: 'blank_line' }
	| { type: 'table_start', attrs: string }
	| { type: 'table_end' }
	| { type: 'table_row', attrs: string }
	| { type: 'table_header', content: string }
	| { type: 'table_cell', content: string }
	| { type: 'definition_list_item', term: string, definition: string }
	| { type: 'preformatted', content: string }
	| { type: 'text_line', content: string }
