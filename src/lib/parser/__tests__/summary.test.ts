import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { extractPlainText, extractPlainTextFromAst, extractSummary, extractSummaryFromAst } from '../summary.js'

describe('extractSummary', () => {
	it('skips a leading infobox and returns the first paragraph', () => {
		const wikitext = `{{Infobox country
| name = Foo
| capital = Bar
}}

The country of '''Foo''' is a place.`
		expect(extractSummary(wikitext)).toBe('The country of Foo is a place.')
	})

	it('skips leading headings and returns the first paragraph', () => {
		const wikitext = `== Overview ==

The republic was founded in 1820.`
		expect(extractSummary(wikitext)).toBe('The republic was founded in 1820.')
	})

	it('returns empty string for content with only files, categories, and templates', () => {
		const wikitext = `{{Infobox country
| name = Foo
}}
[[Category:Countries]]
[[File:Flag.png|thumb|A flag]]`
		expect(extractSummary(wikitext)).toBe('')
	})

	it('uses display text for piped internal links and target for plain links', () => {
		expect(extractSummary('The [[Onchera|Republic]] is large.')).toBe('The Republic is large.')
		expect(extractSummary('See [[Onchera]] for details.')).toBe('See Onchera for details.')
	})

	it('handles external links with display text and bare URLs', () => {
		expect(extractSummary('Visit [https://example.com our site] today.')).toBe('Visit our site today.')
		expect(extractSummary('Visit [https://example.com] today.')).toBe('Visit https://example.com today.')
	})

	it('strips refs and inline templates without leaving doubled spaces', () => {
		const wikitext = `Foo<ref>cite</ref> bar {{tpl|x}} baz.`
		expect(extractSummary(wikitext)).toBe('Foo bar baz.')
	})

	it('flattens inline formatting (bold, italic, strikethrough, sub, sup)', () => {
		const wikitext = `'''Bold''' and ''italic'' and ~~struck~~ and H<sub>2</sub>O and E=mc<sup>2</sup>.`
		expect(extractSummary(wikitext)).toBe('Bold and italic and struck and H2O and E=mc2.')
	})

	it('returns the input unchanged when shorter than maxLength', () => {
		expect(extractSummary('Short text.', { maxLength: 100 })).toBe('Short text.')
	})

	it('truncates on a word boundary and appends an ellipsis', () => {
		const long = 'The quick brown fox jumps over the lazy dog and keeps running far away.'
		const result = extractSummary(long, { maxLength: 30 })
		expect(result.endsWith('\u2026')).toBe(true)
		expect(result.length).toBeLessThanOrEqual(31)
		expect(result).not.toMatch(/\s\u2026$/)
		// Should cut at last whitespace inside the 30-char window.
		expect(result).toBe('The quick brown fox jumps\u2026')
	})

	it('hard-cuts an unbroken token when there is no space in the window', () => {
		const result = extractSummary('Supercalifragilisticexpialidocious extra', { maxLength: 10 })
		expect(result).toBe('Supercalif\u2026')
	})

	it('falls through to the next paragraph when the first contains only refs/templates', () => {
		const wikitext = `<ref>cite</ref>{{tpl|x}}

The real lede is here.`
		expect(extractSummary(wikitext)).toBe('The real lede is here.')
	})

	it('returns empty string when the document has only lists and tables', () => {
		const wikitext = `* item one
* item two

{| class="wikitable"
! header
|-
| cell
|}`
		expect(extractSummary(wikitext)).toBe('')
	})

	it('extractSummary matches extractSummaryFromAst on the same input', () => {
		const wikitext = `== Heading ==

The [[Onchera|Republic]] was founded.`
		const ast = parse(wikitext)
		expect(extractSummary(wikitext, { maxLength: 100 }))
			.toBe(extractSummaryFromAst(ast, { maxLength: 100 }))
	})
})

describe('extractPlainText', () => {
	it('drops infobox bodies even when they span multiple lines', () => {
		const wikitext = `{{Infobox country
| name = Foo
| capital = Bar
| population = 1000
}}

Foo is a country.`
		expect(extractPlainText(wikitext)).toBe('Foo is a country.')
	})

	it('includes prose from headings, paragraphs, lists, and tables', () => {
		const wikitext = `== History ==

Founded in 1820.

* First settlement
* Second settlement

{| class="wikitable"
! Year
| 1820
|}`
		const result = extractPlainText(wikitext)
		expect(result).toContain('History')
		expect(result).toContain('Founded in 1820.')
		expect(result).toContain('First settlement')
		expect(result).toContain('1820')
	})

	it('skips categories, files, refs, and inline templates', () => {
		const wikitext = `Hello<ref>cite</ref> world {{nbsp}}.

[[Category:Greetings]]
[[File:Hello.png|thumb]]`
		const result = extractPlainText(wikitext)
		expect(result).not.toContain('cite')
		expect(result).not.toContain('Greetings')
		expect(result).not.toContain('Hello.png')
		expect(result).toContain('Hello')
		expect(result).toContain('world')
	})

	it('uses link display text consistently with extractSummary', () => {
		const wikitext = `Visit [[Onchera|the Republic]] and [https://example.com our site].`
		expect(extractPlainText(wikitext)).toBe('Visit the Republic and our site.')
	})

	it('returns empty string for documents with only non-prose blocks', () => {
		const wikitext = `{{Infobox country | name = Foo }}
[[Category:Countries]]
[[File:Flag.png]]`
		expect(extractPlainText(wikitext)).toBe('')
	})

	it('extractPlainText matches extractPlainTextFromAst', () => {
		const wikitext = `== A ==

Para [[X|y]] z.

* item`
		const ast = parse(wikitext)
		expect(extractPlainText(wikitext)).toBe(extractPlainTextFromAst(ast))
	})

	it('shares its lede with extractSummary on the same article', () => {
		const wikitext = `{{Infobox country
| name = Foo
}}

Foo is great.

More about Foo.`
		const summary = extractSummary(wikitext)
		const plain = extractPlainText(wikitext)
		expect(plain.startsWith(summary)).toBe(true)
	})
})
