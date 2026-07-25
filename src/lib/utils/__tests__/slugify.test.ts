import { describe, expect, it } from 'vitest'
import { mintEntitySlug, mintLexemeSlug, urlSlugify, wikiSlugify } from '../slugify.js'

describe('mintEntitySlug — the one minting path for entity routes', () => {
	it('mints know slugs in the wiki convention', () => {
		expect(mintEntitySlug('know', 'Aide the Sun')).toBe('Aide_the_Sun')
		expect(mintEntitySlug('know', 'sun')).toBe('Sun')
	})

	it('mints category slugs in the wiki convention', () => {
		expect(mintEntitySlug('category', 'Celestial bodies')).toBe('Celestial_bodies')
	})

	it('mints wordbook slugs in the hyphen convention', () => {
		expect(mintEntitySlug('wordbook', 'Boek')).toBe('boek')
	})

	it('emits NFC regardless of input normalization', () => {
		const combining = 'boe\u0301k' // e + COMBINING ACUTE ACCENT
		const precomposed = 'bo\u00E9k' // é precomposed
		expect(mintEntitySlug('know', combining)).toBe(mintEntitySlug('know', precomposed))
		expect(mintEntitySlug('know', combining)).toBe(mintEntitySlug('know', combining).normalize('NFC'))
	})

	it('does NOT strip accents — boek and bœk stay distinct addresses', () => {
		expect(mintEntitySlug('wordbook', 'boek')).not.toBe(mintEntitySlug('wordbook', 'bœk'))
	})
})

describe('mintLexemeSlug — homograph-suffixed word slugs', () => {
	it('leaves the first homograph unsuffixed', () => {
		expect(mintLexemeSlug('boek', 1)).toBe('boek')
	})

	it('suffixes later homographs', () => {
		expect(mintLexemeSlug('boek', 2)).toBe('boek-2')
		expect(mintLexemeSlug('boek', 3)).toBe('boek-3')
	})

	it('slugifies multi-word headwords', () => {
		expect(mintLexemeSlug('op de boek', 1)).toBe('op-de-boek')
	})
})

describe('style delegation matches the legacy functions', () => {
	it('know = wikiSlugify, wordbook = urlSlugify', () => {
		expect(mintEntitySlug('know', 'the old tongue')).toBe(wikiSlugify('the old tongue'))
		expect(mintEntitySlug('wordbook', 'The Old Tongue')).toBe(urlSlugify('The Old Tongue'))
	})
})
