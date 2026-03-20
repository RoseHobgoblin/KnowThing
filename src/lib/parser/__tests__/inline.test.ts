import { describe, it, expect } from 'vitest'
import { parseInline } from '../inline.js'

describe('inline parser', () => {
	it('parses plain text', () => {
		const nodes = parseInline('Hello world')
		expect(nodes).toEqual([{ type: 'text', text: 'Hello world' }])
	})

	it('parses bold', () => {
		const nodes = parseInline('\'\'\'bold\'\'\'')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('bold')
		if (nodes[0].type === 'bold') {
			expect(nodes[0].children).toEqual([{ type: 'text', text: 'bold' }])
		}
	})

	it('parses italic', () => {
		const nodes = parseInline('\'\'italic\'\'')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('italic')
	})

	it('parses bold+italic', () => {
		const nodes = parseInline('\'\'\'\'\'both\'\'\'\'\'')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('bold')
		if (nodes[0].type === 'bold') {
			expect(nodes[0].children[0].type).toBe('italic')
		}
	})

	it('parses strikethrough with ~~', () => {
		const nodes = parseInline('~~struck~~')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('strikethrough')
	})

	it('parses internal link', () => {
		const nodes = parseInline('[[Onchera]]')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('internal_link')
		if (nodes[0].type === 'internal_link') {
			expect(nodes[0].target).toBe('Onchera')
			expect(nodes[0].display).toBeNull()
		}
	})

	it('parses internal link with display text', () => {
		const nodes = parseInline('[[Oncheran language|Oncheran]]')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'internal_link') {
			expect(nodes[0].target).toBe('Oncheran language')
			expect(nodes[0].display).toEqual([{ type: 'text', text: 'Oncheran' }])
		}
	})

	it('parses category link', () => {
		const nodes = parseInline('[[Category:Countries]]')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('category')
		if (nodes[0].type === 'category') {
			expect(nodes[0].name).toBe('Countries')
		}
	})

	it('parses image', () => {
		const nodes = parseInline('[[File:flag.png|thumb|The flag]]')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('image')
		if (nodes[0].type === 'image') {
			expect(nodes[0].filename).toBe('flag.png')
			expect(nodes[0].options).toEqual([
				{ type: 'thumb' },
				{ type: 'caption', text: 'The flag' },
			])
		}
	})

	it('parses image with width', () => {
		const nodes = parseInline('[[File:map.jpg|300px|left]]')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'image') {
			expect(nodes[0].options).toContainEqual({ type: 'width', value: 300 })
			expect(nodes[0].options).toContainEqual({ type: 'left' })
		}
	})

	it('parses external link', () => {
		const nodes = parseInline('[https://example.com Example]')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('external_link')
		if (nodes[0].type === 'external_link') {
			expect(nodes[0].url).toBe('https://example.com')
			expect(nodes[0].display).toBe('Example')
		}
	})

	it('parses external link without display', () => {
		const nodes = parseInline('[https://example.com]')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'external_link') {
			expect(nodes[0].url).toBe('https://example.com')
			expect(nodes[0].display).toBeNull()
		}
	})

	it('parses template', () => {
		const nodes = parseInline('{{Infobox country|name=Onchera|capital=Amalur}}')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('template')
		if (nodes[0].type === 'template') {
			expect(nodes[0].name).toBe('Infobox country')
			expect(nodes[0].args).toEqual([
				{ name: 'name', value: 'Onchera' },
				{ name: 'capital', value: 'Amalur' },
			])
		}
	})

	it('parses template with positional args', () => {
		const nodes = parseInline('{{Notice|This is important}}')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'template') {
			expect(nodes[0].name).toBe('Notice')
			expect(nodes[0].args).toEqual([{ name: null, value: 'This is important' }])
		}
	})

	it('parses nested templates', () => {
		const nodes = parseInline('{{outer|{{inner|val}}}}')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'template') {
			expect(nodes[0].name).toBe('outer')
			expect(nodes[0].args[0].value).toBe('{{inner|val}}')
		}
	})

	it('parses nowiki', () => {
		const nodes = parseInline('<nowiki>\'\'\'not bold\'\'\'</nowiki>')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('nowiki')
		if (nodes[0].type === 'nowiki') {
			expect(nodes[0].text).toBe('\'\'\'not bold\'\'\'')
		}
	})

	it('parses ref', () => {
		const nodes = parseInline('<ref>Some citation</ref>')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('reference')
		if (nodes[0].type === 'reference') {
			expect(nodes[0].content).toEqual([{ type: 'text', text: 'Some citation' }])
		}
	})

	it('parses references list', () => {
		const nodes = parseInline('<references/>')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('reference_list')
	})

	it('parses line break', () => {
		const nodes = parseInline('before<br/>after')
		expect(nodes).toHaveLength(3)
		expect(nodes[0]).toEqual({ type: 'text', text: 'before' })
		expect(nodes[1]).toEqual({ type: 'line_break' })
		expect(nodes[2]).toEqual({ type: 'text', text: 'after' })
	})

	it('parses subscript', () => {
		const nodes = parseInline('H<sub>2</sub>O')
		expect(nodes).toHaveLength(3)
		expect(nodes[1].type).toBe('subscript')
	})

	it('parses superscript', () => {
		const nodes = parseInline('x<sup>2</sup>y')
		expect(nodes).toHaveLength(3)
		expect(nodes[1].type).toBe('superscript')
	})

	it('parses code block', () => {
		const nodes = parseInline('<syntaxhighlight lang="python">print("hi")</syntaxhighlight>')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'code_block') {
			expect(nodes[0].lang).toBe('python')
			expect(nodes[0].code).toBe('print("hi")')
		}
	})

	it('parses gallery', () => {
		const nodes = parseInline('<gallery>\nimage1.png|Caption 1\nimage2.jpg|Caption 2\n</gallery>')
		expect(nodes).toHaveLength(1)
		if (nodes[0].type === 'gallery') {
			expect(nodes[0].items).toEqual([
				{ filename: 'image1.png', caption: 'Caption 1' },
				{ filename: 'image2.jpg', caption: 'Caption 2' },
			])
		}
	})

	it('parses HTML strikethrough', () => {
		const nodes = parseInline('<s>deleted</s>')
		expect(nodes).toHaveLength(1)
		expect(nodes[0].type).toBe('strikethrough')
	})

	it('parses mixed inline content', () => {
		const nodes = parseInline('The \'\'\'State of [[Onchera]]\'\'\' is a country.')
		// Should produce: text, bold(text, internal_link), text
		expect(nodes.length).toBeGreaterThanOrEqual(3)
		expect(nodes[0]).toEqual({ type: 'text', text: 'The ' })
		expect(nodes[1].type).toBe('bold')
	})

	it('handles HTML comment stripping', () => {
		const nodes = parseInline('before<!-- hidden -->after')
		expect(nodes).toEqual([{ type: 'text', text: 'beforeafter' }])
	})
})
