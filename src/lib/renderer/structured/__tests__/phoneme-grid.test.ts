import { describe, it, expect } from 'vitest'
import { buildPhonemeGrid, cellKey, type PhonemeRow } from '../phoneme-grid.js'

function c(ipa: string, place: string, manner: string, voicing?: 'voiced' | 'voiceless', extras: Partial<PhonemeRow> = {}): PhonemeRow {
	return { ipa, type: 'consonant', place, manner, voicing: voicing ?? null, ...extras }
}

function v(ipa: string, height: string, backness: string, extras: Partial<PhonemeRow> = {}): PhonemeRow {
	return { ipa, type: 'vowel', height, backness, ...extras }
}

describe('buildPhonemeGrid', () => {
	it('returns null for empty input', () => {
		expect(buildPhonemeGrid(null, 'consonant')).toBeNull()
		expect(buildPhonemeGrid([], 'consonant')).toBeNull()
	})

	it('derives columns (place) and rows (manner) in canonical IPA order regardless of input order', () => {
		const rows = [
			// Scramble the input order to prove canonical ordering wins.
			c('k', 'velar', 'plosive', 'voiceless'),
			c('n', 'alveolar', 'nasal', 'voiced'),
			c('p', 'bilabial', 'plosive', 'voiceless'),
			c('m', 'bilabial', 'nasal', 'voiced'),
			c('t', 'alveolar', 'plosive', 'voiceless'),
		]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		expect(grid.columns).toEqual(['bilabial', 'alveolar', 'velar'])
		expect(grid.rows.map(r => r.header)).toEqual(['plosive', 'nasal'])
	})

	it('pushes non-canonical (conlang) axis values to the end alphabetically', () => {
		const rows = [
			c('p', 'bilabial', 'plosive', 'voiceless'),
			c('t', 'alveolar', 'plosive', 'voiceless'),
			c('ǃ', 'velaro-bilabial', 'click', 'voiceless'),
			c('ʛ', 'labio-uvular', 'implosive', 'voiced'),
		]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		// Canonical places first (bilabial, alveolar), then conlang places
		// alphabetically (labio-uvular, velaro-bilabial).
		expect(grid.columns).toEqual(['bilabial', 'alveolar', 'labio-uvular', 'velaro-bilabial'])
	})

	it('pairs voiceless before voiced in the same cell', () => {
		const rows = [
			c('b', 'bilabial', 'plosive', 'voiced'),
			c('p', 'bilabial', 'plosive', 'voiceless'),
		]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		const cell = grid.cells.get(cellKey({ header: 'plosive' }, 'bilabial'))!
		expect(cell.map(p => p.ipa)).toEqual(['p', 'b'])
	})

	it('leaves sparse cells absent rather than empty', () => {
		const rows = [c('p', 'bilabial', 'plosive', 'voiceless')]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		expect(grid.cells.has(cellKey({ header: 'plosive' }, 'bilabial'))).toBe(true)
		expect(grid.cells.has(cellKey({ header: 'nasal' }, 'bilabial'))).toBe(false)
	})

	it('uses subtype to create distinct sub-rows in canonical order (plain → tense → aspirated)', () => {
		const rows = [
			// Scrambled input; canonical subtype order drives the output.
			c('pʰ', 'bilabial', 'plosive', 'voiceless', { subtype: 'aspirated' }),
			c('p͈', 'bilabial', 'plosive', 'voiceless', { subtype: 'tense' }),
			c('p', 'bilabial', 'plosive', 'voiceless', { subtype: 'plain' }),
		]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		expect(grid.rows).toEqual([
			{ header: 'plosive', subtype: 'plain' },
			{ header: 'plosive', subtype: 'tense' },
			{ header: 'plosive', subtype: 'aspirated' },
		])
	})

	it('collects footnotes in order and indexes them', () => {
		const rows = [
			c('p', 'bilabial', 'plosive', 'voiceless'),
			c('ʔ', 'glottal', 'plosive', 'voiceless', { notes: 'only word-final' }),
			c('r', 'alveolar', 'trill', 'voiced', { notes: '[ɾ] intervocalically' }),
		]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		expect(grid.footnotes).toEqual([
			{ index: 1, ipa: 'ʔ', text: 'only word-final' },
			{ index: 2, ipa: 'r', text: '[ɾ] intervocalically' },
		])
	})

	it('builds a vowel grid from height × backness in canonical order', () => {
		const rows = [
			// Input order jumbled; output must be front → central → back
			// and close → open regardless.
			v('a', 'open', 'central'),
			v('u', 'close', 'back', { rounded: true }),
			v('i', 'close', 'front'),
		]
		const grid = buildPhonemeGrid(rows, 'vowel')!
		expect(grid.columns).toEqual(['front', 'central', 'back'])
		expect(grid.rows.map(r => r.header)).toEqual(['close', 'open'])
		expect(grid.cells.get(cellKey({ header: 'close' }, 'front'))?.[0].ipa).toBe('i')
	})

	it('sorts unrounded before rounded vowels within a cell', () => {
		const rows = [
			v('y', 'close', 'front', { rounded: true }),
			v('i', 'close', 'front', { rounded: false }),
		]
		const grid = buildPhonemeGrid(rows, 'vowel')!
		const cell = grid.cells.get(cellKey({ header: 'close' }, 'front'))!
		expect(cell.map(p => p.ipa)).toEqual(['i', 'y'])
	})

	it('ignores phonemes missing an axis value but still records their footnotes', () => {
		const rows = [
			c('p', 'bilabial', 'plosive', 'voiceless'),
			{ ipa: 'ʔ', type: 'consonant', notes: 'see footnote' } as PhonemeRow,
		]
		const grid = buildPhonemeGrid(rows, 'consonant')!
		// The /ʔ/ entry has no place/manner so it doesn't land in any cell…
		const total = [...grid.cells.values()].flat().length
		expect(total).toBe(1)
		// …but its footnote is still collected so the editor knows it exists.
		expect(grid.footnotes).toEqual([{ index: 1, ipa: 'ʔ', text: 'see footnote' }])
	})
})
