import { describe, it, expect } from 'vitest'
import { IPA_SECTIONS, IPA_LOOKUP, lookupIpa } from '../ipa-chart.js'

describe('IPA chart', () => {
	it('every entry has a type', () => {
		for (const section of IPA_SECTIONS) {
			for (const entry of section.entries) {
				expect(entry.type, `entry ${entry.symbol} missing type`).toBeTruthy()
			}
		}
	})

	it('pulmonic consonants have place and manner', () => {
		const pulmonic = IPA_SECTIONS.find(s => s.id === 'pulmonic')!
		for (const entry of pulmonic.entries) {
			expect(entry.type).toBe('consonant')
			expect(entry.place, `${entry.symbol} missing place`).toBeTruthy()
			expect(entry.manner, `${entry.symbol} missing manner`).toBeTruthy()
		}
	})

	it('vowels have height and backness', () => {
		const vowels = IPA_SECTIONS.find(s => s.id === 'vowels')!
		for (const entry of vowels.entries) {
			expect(entry.type).toBe('vowel')
			expect(entry.height, `${entry.symbol} missing height`).toBeTruthy()
			expect(entry.backness, `${entry.symbol} missing backness`).toBeTruthy()
		}
	})

	it('IPA_LOOKUP resolves common symbols', () => {
		expect(lookupIpa('p')?.place).toBe('bilabial')
		expect(lookupIpa('θ')?.manner).toBe('fricative')
		expect(lookupIpa('i')?.height).toBe('close')
		expect(lookupIpa('t͡ʃ')?.manner).toBe('affricate')
	})

	it('pulmonic voicing pairs both exist (where applicable)', () => {
		// /p/-/b/, /t/-/d/, /k/-/ɡ/ are classic pairs
		expect(lookupIpa('p')?.voicing).toBe('voiceless')
		expect(lookupIpa('b')?.voicing).toBe('voiced')
		expect(lookupIpa('k')?.voicing).toBe('voiceless')
		expect(lookupIpa('ɡ')?.voicing).toBe('voiced')
	})

	it('section entries are also present in the flat lookup', () => {
		for (const section of IPA_SECTIONS) {
			for (const entry of section.entries) {
				expect(IPA_LOOKUP.get(entry.symbol)?.symbol).toBe(entry.symbol)
			}
		}
	})
})
