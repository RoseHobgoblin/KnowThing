export interface KeyedProvider { key: string }

export function createProviderMap<T extends KeyedProvider>(providers: readonly T[]): ReadonlyMap<string, T> {
	const result = new Map<string, T>()
	for (const provider of providers) {
		if (result.has(provider.key)) throw new Error(`Duplicate provider registration: ${provider.key}`)
		result.set(provider.key, provider)
	}
	return immutableMap(result)
}

export function createScopedProviderMap<T extends { scope: string }>(providers: readonly T[]): ReadonlyMap<string, T> {
	return createProviderMap(providers.map(provider => ({ ...provider, key: provider.scope })))
}
import { immutableMap } from '$lib/utils/immutable-map.js'
