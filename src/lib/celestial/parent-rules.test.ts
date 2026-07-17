import { describe, it, expect } from 'vitest'
import { validateParentKind, isCelestialKind, CELESTIAL_KINDS, type CelestialKind } from './parent-rules.js'

describe('validateParentKind', () => {
	// The full kind × parentKind matrix. `null` in the expectation means the
	// combination is legal; a string means it must be rejected (any message).
	const matrix: Array<[CelestialKind, CelestialKind | null, boolean]> = [
		// system: never has a parent
		['system', null, true],
		['system', 'system', false],
		['system', 'star', false],
		['system', 'body', false],
		// star: field star (no parent), member of a system, or companion of a star
		['star', null, true],
		['star', 'system', true],
		['star', 'star', true],
		['star', 'body', false],
		// body: always orbits a star or another body
		['body', null, false],
		['body', 'system', false],
		['body', 'star', true],
		['body', 'body', true],
	]

	for (const [kind, parentKind, legal] of matrix) {
		it(`${kind} orbiting ${parentKind ?? 'nothing'} is ${legal ? 'legal' : 'rejected'}`, () => {
			const message = validateParentKind(kind, parentKind)
			if (legal) expect(message).toBeNull()
			else expect(message).toBeTypeOf('string')
		})
	}

	it('ring systems must orbit a body, not a star', () => {
		expect(validateParentKind('body', 'star', 'ring_system')).toBeTypeOf('string')
		expect(validateParentKind('body', 'body', 'ring_system')).toBeNull()
	})

	it('ordinary body types may orbit stars directly', () => {
		expect(validateParentKind('body', 'star', 'planet')).toBeNull()
		expect(validateParentKind('body', 'star', 'asteroid')).toBeNull()
	})
})

describe('isCelestialKind', () => {
	it('accepts exactly the three kinds', () => {
		for (const kind of CELESTIAL_KINDS) expect(isCelestialKind(kind)).toBe(true)
		expect(isCelestialKind('planet')).toBe(false)
		expect(isCelestialKind('moon')).toBe(false)
		expect(isCelestialKind(null)).toBe(false)
		expect(isCelestialKind(42)).toBe(false)
	})
})
