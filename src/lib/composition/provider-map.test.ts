import { describe, expect, it } from 'vitest'
import { createProviderMap, createScopedProviderMap } from './provider-map.js'
import { createNamespaceProviders, resolveNamespace } from '$lib/namespaces/providers.js'
import { createStructuredDataProviders, resolveStructuredDocument } from '$lib/structured-data/providers.js'

describe('provider composition', () => {
	it('rejects duplicate keys and scopes', () => {
		expect(() => createProviderMap([{ key: 'x' }, { key: 'x' }])).toThrow('Duplicate provider')
		expect(() => createScopedProviderMap([{ scope: 'x' }, { scope: 'x' }])).toThrow('Duplicate provider')
	})

	it('returns null for missing namespace and structured-data providers', async () => {
		await expect(resolveNamespace(createNamespaceProviders([]), 'Rodder', 'x')).resolves.toBeNull()
		await expect(resolveStructuredDocument(createStructuredDataProviders([]), 'planet', 'x')).resolves.toBeNull()
	})

	it('isolates optional provider failures', async () => {
		const namespaces = createNamespaceProviders([{ namespace: 'Rodder' as const, resolve: async () => {
			throw new Error('offline')
		} }])
		const structured = createStructuredDataProviders([{ kind: 'planet', resolve: async () => {
			throw new Error('offline')
		} }])
		await expect(resolveNamespace(namespaces, 'Rodder', 'x')).resolves.toBeNull()
		await expect(resolveStructuredDocument(structured, 'planet', 'x')).resolves.toBeNull()
	})
})
