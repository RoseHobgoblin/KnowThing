import { describe, expect, it } from 'vitest'
import type { Component } from 'svelte'
import { createTemplateRegistry, type BuiltinEntry } from './registry.js'

const component = (() => {}) as unknown as Component
const entry: BuiltinEntry = { component }

describe('Wiki template composition', () => {
	it('normalizes names and is read-only to consumers', () => {
		const registry = createTemplateRegistry(new Map([[' Feature Template ', entry]]))
		expect(registry.get('feature template')).toBe(entry)
		expect('set' in registry).toBe(false)
	})

	it('rejects duplicate names across feature registries', () => {
		expect(() => createTemplateRegistry(new Map([['map', entry]]), new Map([['MAP', entry]]))).toThrow('Duplicate Wiki template')
	})
})
