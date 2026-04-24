import { describe, it, expect } from 'vitest'
import { IPA_MODIFIERS, applyModifiers, modifiersFor } from '../ipa-modifiers.js'

describe('applyModifiers', () => {
	it('returns the base symbol when no modifiers are selected', () => {
		expect(applyModifiers('p', new Set())).toBe('p')
	})

	it('appends a single spacing modifier (aspiration)', () => {
		expect(applyModifiers('p', new Set(['aspirated']))).toBe('pʰ')
	})

	it('appends a combining diacritic (nasalization)', () => {
		expect(applyModifiers('a', new Set(['nasalized']))).toBe('ã')
	})

	it('stacks multiple modifiers in the canonical order', () => {
		// Canonical order in IPA_MODIFIERS: long comes before aspirated.
		// So regardless of which order the IDs are passed in, output is p + ː + ʰ.
		const out = applyModifiers('p', new Set(['aspirated', 'long']))
		expect(out).toBe('pːʰ')
	})

	it('composes long vowels /aː/', () => {
		expect(applyModifiers('a', new Set(['long']))).toBe('aː')
	})

	it('composes creaky nasalized /ã̰/', () => {
		// nasalized (̃) comes before creaky (̰) in canonical order.
		const out = applyModifiers('a', new Set(['nasalized', 'creaky']))
		expect(out).toBe('ã̰')
	})

	it('composes ejective stops /pʼ/', () => {
		expect(applyModifiers('p', new Set(['ejective']))).toBe('pʼ')
	})
})

describe('modifiersFor', () => {
	it('returns consonant-applicable modifiers + both-modifiers for consonants', () => {
		const mods = modifiersFor('consonant')
		const ids = new Set(mods.map(m => m.id))
		expect(ids.has('aspirated')).toBe(true) // consonant-only
		expect(ids.has('long')).toBe(true) // both
		expect(ids.has('nasalized')).toBe(false) // vowel-only
	})

	it('returns vowel-applicable modifiers + both-modifiers for vowels', () => {
		const mods = modifiersFor('vowel')
		const ids = new Set(mods.map(m => m.id))
		expect(ids.has('nasalized')).toBe(true)
		expect(ids.has('long')).toBe(true)
		expect(ids.has('aspirated')).toBe(false)
	})

	it('treats diphthongs as vowels', () => {
		const mods = modifiersFor('diphthong')
		expect(mods.some(m => m.id === 'nasalized')).toBe(true)
	})

	it('returns only both-type modifiers for special phonemes', () => {
		const mods = modifiersFor('special')
		for (const m of mods) expect(m.appliesTo).toBe('both')
	})
})

describe('modifier catalog integrity', () => {
	it('every mutex group has at least two members (else mutex is pointless)', () => {
		const groups = new Map<string, number>()
		for (const m of IPA_MODIFIERS) {
			if (m.mutex) groups.set(m.mutex, (groups.get(m.mutex) ?? 0) + 1)
		}
		for (const [name, count] of groups) {
			expect(count, `mutex group "${name}" has only ${count} member(s)`).toBeGreaterThanOrEqual(2)
		}
	})

	it('suffixes are non-empty', () => {
		for (const m of IPA_MODIFIERS) expect(m.suffix.length).toBeGreaterThan(0)
	})

	it('ids are unique', () => {
		const ids = IPA_MODIFIERS.map(m => m.id)
		expect(new Set(ids).size).toBe(ids.length)
	})
})
