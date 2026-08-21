import { describe, it, expect } from 'vitest'
import { validateParentKind, isRodderKind, RODDER_KINDS, type RodderKind } from './public/parent-rules.js'

describe('validateParentKind', () => {
	// The full kind × parentKind matrix. `null` in the expectation means the
	// combination is legal; a string means it must be rejected (any message).
	const matrix: Array<[RodderKind, RodderKind | null, boolean]> = [
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
		// body: always orbits something — a star, another body, or a system
		// barycenter (circumbinary)
		['body', null, true],
		['body', 'system', true],
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

	it('ring systems must orbit a body, not a star or system', () => {
		expect(validateParentKind('body', null, 'ring_system')).toBeTypeOf('string')
		expect(validateParentKind('body', 'star', 'ring_system')).toBeTypeOf('string')
		expect(validateParentKind('body', 'system', 'ring_system')).toBeTypeOf('string')
		expect(validateParentKind('body', 'body', 'ring_system')).toBeNull()
	})

	it('ordinary body types may orbit stars directly', () => {
		expect(validateParentKind('body', 'star', 'planet')).toBeNull()
		expect(validateParentKind('body', 'star', 'asteroid')).toBeNull()
	})
})

describe('isRodderKind', () => {
	it('accepts exactly the three kinds', () => {
		for (const kind of RODDER_KINDS) expect(isRodderKind(kind)).toBe(true)
		expect(isRodderKind('planet')).toBe(false)
		expect(isRodderKind('moon')).toBe(false)
		expect(isRodderKind(null)).toBe(false)
		expect(isRodderKind(42)).toBe(false)
	})
})
