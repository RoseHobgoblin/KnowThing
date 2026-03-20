import { describe, it, expect } from 'vitest'
import {
	substituteParams as substituteParameters,
	processIncludeTags,
	expandTemplate,
} from './template-expansion.js'
import type { TemplateArg as TemplateArgument } from './types.js'

describe('substituteParams', () => {
	it('substitutes positional params', () => {
		const args: TemplateArgument[] = [
			{ name: null, value: 'Hello' },
			{ name: null, value: 'World' },
		]
		expect(substituteParameters('{{{1}}} {{{2}}}', args)).toBe('Hello World')
	})

	it('substitutes named params', () => {
		const args: TemplateArgument[] = [
			{ name: 'title', value: 'Gondor' },
			{ name: 'type', value: 'Kingdom' },
		]
		expect(substituteParameters('{{{title}}} is a {{{type}}}', args)).toBe('Gondor is a Kingdom')
	})

	it('is case-insensitive for param names', () => {
		const args: TemplateArgument[] = [{ name: 'Title', value: 'Rohan' }]
		expect(substituteParameters('{{{title}}}', args)).toBe('Rohan')
	})

	it('uses default value when param missing', () => {
		expect(substituteParameters('{{{name|Unknown}}}', [])).toBe('Unknown')
	})

	it('prefers provided value over default', () => {
		const args: TemplateArgument[] = [{ name: 'name', value: 'Aragorn' }]
		expect(substituteParameters('{{{name|Unknown}}}', args)).toBe('Aragorn')
	})

	it('returns empty string for missing param with no default', () => {
		expect(substituteParameters('{{{missing}}}', [])).toBe('')
	})

	it('handles mixed positional and named', () => {
		const args: TemplateArgument[] = [
			{ name: null, value: 'First' },
			{ name: 'key', value: 'Named' },
			{ name: null, value: 'Second' },
		]
		expect(substituteParameters('{{{1}}} {{{key}}} {{{2}}}', args)).toBe('First Named Second')
	})

	it('leaves nested triple braces alone when resolved', () => {
		const args: TemplateArgument[] = [{ name: 'x', value: 'val' }]
		expect(substituteParameters('before {{{x}}} after', args)).toBe('before val after')
	})
})

describe('processIncludeTags', () => {
	describe('transcluding (embedding)', () => {
		it('extracts only onlyinclude content if present', () => {
			const source = 'ignored <onlyinclude>kept</onlyinclude> also ignored'
			expect(processIncludeTags(source, true)).toBe('kept')
		})

		it('concatenates multiple onlyinclude blocks', () => {
			const source = '<onlyinclude>A</onlyinclude> skip <onlyinclude>B</onlyinclude>'
			expect(processIncludeTags(source, true)).toBe('AB')
		})

		it('strips noinclude blocks', () => {
			const source = 'keep <noinclude>docs only</noinclude> this'
			expect(processIncludeTags(source, true)).toBe('keep  this')
		})

		it('unwraps includeonly tags', () => {
			const source = 'before <includeonly>transcluded</includeonly> after'
			expect(processIncludeTags(source, true)).toBe('before transcluded after')
		})
	})

	describe('direct view (template page)', () => {
		it('strips includeonly blocks', () => {
			const source = 'visible <includeonly>hidden</includeonly> also visible'
			expect(processIncludeTags(source, false)).toBe('visible  also visible')
		})

		it('unwraps noinclude tags', () => {
			const source = 'text <noinclude>documentation</noinclude> more'
			expect(processIncludeTags(source, false)).toBe('text documentation more')
		})

		it('unwraps onlyinclude tags', () => {
			const source = 'before <onlyinclude>content</onlyinclude> after'
			expect(processIncludeTags(source, false)).toBe('before content after')
		})
	})
})

describe('expandTemplate', () => {
	it('combines include processing and param substitution', () => {
		const source = '<noinclude>Docs here</noinclude>Name: {{{name|???}}}'
		const args: TemplateArgument[] = [{ name: 'name', value: 'Elrond' }]
		expect(expandTemplate(source, args)).toBe('Name: Elrond')
	})

	it('respects max depth', () => {
		const result = expandTemplate('text', [], 10)
		expect(result).toContain('depth exceeded')
	})

	it('handles empty template', () => {
		expect(expandTemplate('', [])).toBe('')
	})

	it('full infobox-like expansion', () => {
		const source = `<noinclude>Template documentation</noinclude><includeonly>{| class="infobox"
|-
! {{{title|Untitled}}}
|-
| Type: {{{type|Unknown}}}
|-
| Region: {{{region|N/A}}}
|}</includeonly>`

		const args: TemplateArgument[] = [
			{ name: 'title', value: 'Gondor' },
			{ name: 'type', value: 'Kingdom' },
			{ name: 'region', value: 'Southern Middle-earth' },
		]

		const result = expandTemplate(source, args)
		expect(result).toContain('Gondor')
		expect(result).toContain('Kingdom')
		expect(result).toContain('Southern Middle-earth')
		expect(result).not.toContain('documentation')
	})
})
