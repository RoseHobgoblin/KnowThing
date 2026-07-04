import { describe, it, expect } from 'vitest'
import { buildPhonemeGrid, cellKey, type PhonemeRow } from '../phoneme-grid.js'

const plain = (ipa: string, extra: Partial<PhonemeRow> = {}): PhonemeRow => ({
	ipa,
	type: 'consonant',
	place: 'bilabial',
	manner: 'plosive',
	voicing: 'voiceless',
	...extra,
})

describe('buildPhonemeGrid — geminates share the plain row', () => {
	it('does not create a separate (geminate) manner row', () => {
		const grid = buildPhonemeGrid([
			plain('p'),
			plain('pː', { subtype: 'geminate' }),
		], 'consonant')!

		// One row: plosive with no subtype — no "plosive (geminate)" clone.
		expect(grid.rows).toEqual([{ header: 'plosive', subtype: undefined }])
	})

	it('renders plain before geminate within the shared cell', () => {
		const grid = buildPhonemeGrid([
			plain('pː', { subtype: 'geminate' }),
			plain('p'),
		], 'consonant')!

		const cell = grid.cells.get(cellKey(grid.rows[0], 'bilabial'))!
		expect(cell.map(phoneme => phoneme.ipa)).toEqual(['p', 'pː'])
	})

	it('keeps non-geminate subtypes as their own rows (aspirated etc.)', () => {
		const grid = buildPhonemeGrid([
			plain('p'),
			plain('pʰ', { subtype: 'aspirated' }),
		], 'consonant')!

		expect(grid.rows).toEqual([
			{ header: 'plosive', subtype: undefined },
			{ header: 'plosive', subtype: 'aspirated' },
		])
	})

	it('voicing order still wins over length order in a cell', () => {
		const grid = buildPhonemeGrid([
			plain('bː', { voicing: 'voiced', subtype: 'geminate' }),
			plain('p'),
			plain('b', { voicing: 'voiced' }),
			plain('pː', { subtype: 'geminate' }),
		], 'consonant')!

		const cell = grid.cells.get(cellKey(grid.rows[0], 'bilabial'))!
		expect(cell.map(phoneme => phoneme.ipa)).toEqual(['p', 'pː', 'b', 'bː'])
	})
})
