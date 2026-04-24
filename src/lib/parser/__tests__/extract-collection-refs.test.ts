import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { extractCollectionRefs as extractCollectionReferences } from '../index.js'

describe('extractCollectionRefs', () => {
	it('finds {{consonants|slug}}', () => {
		const ast = parse('Some text {{consonants|oncheran}} more')
		expect(extractCollectionReferences(ast)).toEqual([{ type: 'consonants', slug: 'oncheran' }])
	})

	it('finds {{vowels|slug}} and {{phonology|slug}}', () => {
		const ast = parse('{{vowels|oncheran}}\n\n{{phonology|qeren}}')
		expect(extractCollectionReferences(ast)).toEqual([
			{ type: 'vowels', slug: 'oncheran' },
			{ type: 'phonology', slug: 'qeren' },
		])
	})

	it('is case-insensitive for the template name', () => {
		const ast = parse('{{Consonants|oncheran}}')
		expect(extractCollectionReferences(ast)).toEqual([{ type: 'consonants', slug: 'oncheran' }])
	})

	it('ignores unrelated templates', () => {
		const ast = parse('{{quote|foo}} {{date|2024-01-01}}')
		expect(extractCollectionReferences(ast)).toEqual([])
	})

	it('drops refs with empty slug', () => {
		const ast = parse('{{consonants|}}')
		expect(extractCollectionReferences(ast)).toEqual([])
	})
})
