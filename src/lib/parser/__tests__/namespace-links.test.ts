import { describe, it, expect } from 'vitest'
import { parseInline } from '../inline.js'
import { extractDomainLinksFromAst } from '../index.js'
import type { WikiNode } from '../types.js'

function parseToOne(input: string): WikiNode {
	const nodes = parseInline(input)
	expect(nodes).toHaveLength(1)
	return nodes[0]
}

describe('namespace link parsing', () => {
	it('parses a TitleCase namespace link', () => {
		const node = parseToOne('[[Celestial:Therne]]')
		expect(node).toMatchObject({ type: 'namespace_link', namespace: 'Celestial', identifier: 'Therne' })
	})

	it('canonicalises lowercase namespace prefixes', () => {
		const node = parseToOne('[[celestial:therne]]')
		expect(node).toMatchObject({ type: 'namespace_link', namespace: 'Celestial', identifier: 'therne' })
	})

	it('preserves identifier case verbatim', () => {
		const node = parseToOne('[[Calendar:Iron_Flowers]]')
		expect(node).toMatchObject({ type: 'namespace_link', namespace: 'Calendar', identifier: 'Iron_Flowers' })
	})

	it('keeps display labels separate', () => {
		const node = parseToOne('[[Celestial:Therne|the Therne sun]]')
		expect(node.type).toBe('namespace_link')
		if (node.type !== 'namespace_link') return
		expect(node.namespace).toBe('Celestial')
		expect(node.identifier).toBe('Therne')
		expect(node.display).not.toBeNull()
	})

	it('falls back to internal_link when prefix is not a registered namespace', () => {
		const node = parseToOne('[[foo:bar]]')
		expect(node.type).toBe('internal_link')
	})

	it('treats [[Category:Foo]] as a category tag, not a link', () => {
		const node = parseToOne('[[Category:Mountains]]')
		expect(node).toMatchObject({ type: 'category', name: 'Mountains' })
	})

	it('treats [[:Category:Foo]] as a namespace link to the category page', () => {
		const node = parseToOne('[[:Category:Mountains]]')
		expect(node).toMatchObject({ type: 'namespace_link', namespace: 'Category', identifier: 'Mountains' })
	})
})

describe('wordbook link parsing', () => {
	it('parses Wordbook/Lang/Word slash form', () => {
		const node = parseToOne('[[Wordbook/Oncheran/Makala]]')
		expect(node).toMatchObject({ type: 'wordbook_link', language: 'oncheran', word: 'Makala' })
	})

	it('parses Wordbook/Lang language-only form', () => {
		const node = parseToOne('[[Wordbook/Oncheran]]')
		expect(node).toMatchObject({ type: 'wordbook_link', language: 'oncheran', word: '' })
	})

	it('keeps legacy [[wb:lang:word]] working', () => {
		const node = parseToOne('[[wb:oncheran:makala]]')
		expect(node).toMatchObject({ type: 'wordbook_link', language: 'oncheran', word: 'makala' })
	})
})

describe('extractDomainLinksFromAst', () => {
	it('collects namespace_link, wordbook_link, and legacy domain_link entries', () => {
		const ast: WikiNode = {
			type: 'document',
			children: [
				{ type: 'paragraph', children: parseInline('See [[Celestial:Therne]] and [[Wordbook/Oncheran/Makala]]') },
			],
		}
		const links = extractDomainLinksFromAst(ast)
		expect(links).toEqual(expect.arrayContaining([
			{ domain: 'celestial', target: 'Therne' },
			{ domain: 'wordbook', target: 'oncheran/Makala' },
		]))
	})

	it('does not include same-domain internal_link', () => {
		const ast: WikiNode = {
			type: 'document',
			children: [
				{ type: 'paragraph', children: parseInline('Plain [[Foo]] link') },
			],
		}
		expect(extractDomainLinksFromAst(ast)).toEqual([])
	})
})
