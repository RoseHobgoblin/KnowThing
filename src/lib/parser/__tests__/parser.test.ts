import { describe, it, expect } from 'vitest'
import { parseWikitext, extractLinks, extractCategories, extractImages, extractLinksFromAst, extractCategoriesFromAst, extractImagesFromAst, stripMarkup } from '../index.js'
import type { WikiNode } from '../types.js'

describe('parser', () => {
	it('parses empty input', () => {
		const ast = parseWikitext('')
		expect(ast.type).toBe('document')
		if (ast.type === 'document') {
			expect(ast.children).toHaveLength(0)
		}
	})

	it('parses a paragraph', () => {
		const ast = parseWikitext('Hello world.')
		expect(ast.type).toBe('document')
		if (ast.type === 'document') {
			expect(ast.children).toHaveLength(1)
			expect(ast.children[0].type).toBe('paragraph')
		}
	})

	it('parses headings and paragraphs', () => {
		const ast = parseWikitext('== History ==\n\nOnchera has a long history.')
		if (ast.type === 'document') {
			expect(ast.children[0].type).toBe('heading')
			if (ast.children[0].type === 'heading') {
				expect(ast.children[0].level).toBe(2)
			}
			expect(ast.children[1].type).toBe('paragraph')
		}
	})

	it('parses unordered lists', () => {
		const ast = parseWikitext('* Item 1\n* Item 2\n* Item 3')
		if (ast.type === 'document') {
			expect(ast.children).toHaveLength(1)
			expect(ast.children[0].type).toBe('unordered_list')
			if (ast.children[0].type === 'unordered_list') {
				expect(ast.children[0].items).toHaveLength(3)
			}
		}
	})

	it('parses ordered lists', () => {
		const ast = parseWikitext('# First\n# Second')
		if (ast.type === 'document') {
			expect(ast.children[0].type).toBe('ordered_list')
			if (ast.children[0].type === 'ordered_list') {
				expect(ast.children[0].items).toHaveLength(2)
			}
		}
	})

	it('parses horizontal rule', () => {
		const ast = parseWikitext('----')
		if (ast.type === 'document') {
			expect(ast.children[0].type).toBe('horizontal_rule')
		}
	})

	it('parses preformatted text', () => {
		const ast = parseWikitext(' code line 1\n code line 2')
		if (ast.type === 'document') {
			expect(ast.children[0].type).toBe('preformatted')
			if (ast.children[0].type === 'preformatted') {
				expect(ast.children[0].text).toBe('code line 1\ncode line 2')
			}
		}
	})

	it('parses tables', () => {
		const input = '{| class="wikitable"\n|-\n! Name !! Population\n|-\n| Onchera || 100,000,000\n|}'
		const ast = parseWikitext(input)
		if (ast.type === 'document') {
			expect(ast.children[0].type).toBe('table')
			if (ast.children[0].type === 'table') {
				expect(ast.children[0].attrs).toBe('class="wikitable"')
				expect(ast.children[0].rows.length).toBeGreaterThanOrEqual(1)
			}
		}
	})

	it('parses definition lists', () => {
		const ast = parseWikitext('; Capital : Amalur\n; Language : Oncheran')
		if (ast.type === 'document') {
			expect(ast.children[0].type).toBe('definition_list')
			if (ast.children[0].type === 'definition_list') {
				expect(ast.children[0].items).toHaveLength(2)
			}
		}
	})

	it('hoists categories out of paragraphs', () => {
		const ast = parseWikitext('Some text.\n[[Category:Countries]]\n[[Category:Monarchies]]')
		if (ast.type === 'document') {
			const types = ast.children.map(c => c.type)
			expect(types).toContain('category')
		}
	})

	it('parses complex mixed content', () => {
		const input = `== Geography ==

Onchera is located in the '''western''' part of the continent.

* Northern region
* Southern region

{| class="wikitable"
|-
! Region !! Capital
|-
| North || [[Amalur]]
|}

[[Category:Geography]]`

		const ast = parseWikitext(input)
		if (ast.type === 'document') {
			const types = ast.children.map(c => c.type)
			expect(types).toContain('heading')
			expect(types).toContain('paragraph')
			expect(types).toContain('unordered_list')
			expect(types).toContain('table')
			expect(types).toContain('category')
		}
	})
})

describe('extractLinks', () => {
	it('extracts internal link targets', () => {
		const links = extractLinks('Visit [[Amalur]] and [[Onchera]].')
		expect(links).toEqual(['Amalur', 'Onchera'])
	})

	it('extracts links with display text', () => {
		const links = extractLinks('The [[Oncheran language|language]] is unique.')
		expect(links).toEqual(['Oncheran language'])
	})

	it('does not include categories', () => {
		const links = extractLinks('Text [[Category:Test]]')
		expect(links).toEqual([])
	})
})

describe('extractCategories', () => {
	it('extracts category names', () => {
		const cats = extractCategories('[[Category:Countries]]\n[[Category:Monarchies]]')
		expect(cats).toEqual(['Countries', 'Monarchies'])
	})
})

describe('extractImages', () => {
	it('extracts image filenames', () => {
		const images = extractImages('[[File:flag.png|thumb]] and [[File:map.jpg]]')
		expect(images).toEqual(['flag.png', 'map.jpg'])
	})
})

describe('extractLinksFromAst', () => {
	it('extracts links from a pre-parsed AST', () => {
		const ast = parseWikitext('Visit [[Amalur]] and [[Onchera]].')
		expect(extractLinksFromAst(ast)).toEqual(['Amalur', 'Onchera'])
	})

	it('returns empty array for no links', () => {
		const ast = parseWikitext('No links here.')
		expect(extractLinksFromAst(ast)).toEqual([])
	})
})

describe('extractCategoriesFromAst', () => {
	it('extracts categories from a pre-parsed AST', () => {
		const ast = parseWikitext('[[Category:Countries]]\n[[Category:Monarchies]]')
		expect(extractCategoriesFromAst(ast)).toEqual(['Countries', 'Monarchies'])
	})
})

describe('extractImagesFromAst', () => {
	it('extracts images from a pre-parsed AST', () => {
		const ast = parseWikitext('[[File:flag.png|thumb]] and [[File:map.jpg]]')
		expect(extractImagesFromAst(ast)).toEqual(['flag.png', 'map.jpg'])
	})

	it('extracts image filenames from template arguments', () => {
		const ast = parseWikitext(
			'{{Infobox country\n| image_flag = Flag_of_Onchera.svg\n| image_coat = Coat.png\n| capital = Amallu\n}}',
		)
		expect(extractImagesFromAst(ast).sort()).toEqual(['Coat.png', 'Flag_of_Onchera.svg'])
	})

	it('ignores free-form text in template arguments', () => {
		const ast = parseWikitext(
			'{{Infobox country\n| capital = Amallu (see ref.png in section)\n| image_flag = Foo.svg\n}}',
		)
		expect(extractImagesFromAst(ast)).toEqual(['Foo.svg'])
	})

	it('deduplicates images that appear in both forms', () => {
		const ast = parseWikitext(
			'[[File:flag.png|thumb]]\n{{Infobox country|image_flag=flag.png}}',
		)
		expect(extractImagesFromAst(ast)).toEqual(['flag.png'])
	})
})

describe('stripMarkup', () => {
	it('strips bold and italic', () => {
		expect(stripMarkup('\'\'\'bold\'\'\' and \'\'italic\'\'')).toBe('bold and italic')
	})

	it('strips internal links keeping display text', () => {
		expect(stripMarkup('[[Oncheran language|Oncheran]]')).toBe('Oncheran')
	})

	it('strips categories', () => {
		expect(stripMarkup('text [[Category:Test]]')).toBe('text')
	})

	it('strips headings', () => {
		expect(stripMarkup('== Title ==')).toBe('Title')
	})
})
