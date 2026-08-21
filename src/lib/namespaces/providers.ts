import type { NamespaceKey } from './registry.js'
import { immutableMap } from '$lib/utils/immutable-map.js'

export interface ResolvedTarget {
	kind: string | null
	href: string
	title: string
	exists: boolean
	entityId?: number
}

export interface NamespaceProvider {
	namespace: NamespaceKey
	resolve(identifier: string): Promise<ResolvedTarget>
}

export function buildNamespaceHref(namespace: NamespaceKey, identifier: string): string {
	return `/${namespace}:${encodeURIComponent(identifier).replaceAll('%20', '_')}`
}

export function missingNamespaceTarget(namespace: NamespaceKey, identifier: string): ResolvedTarget {
	return {
		kind: null,
		href: buildNamespaceHref(namespace, identifier),
		title: identifier,
		exists: false,
	}
}

export function createNamespaceProviders(providers: readonly NamespaceProvider[]): ReadonlyMap<NamespaceKey, NamespaceProvider> {
	const result = new Map<NamespaceKey, NamespaceProvider>()
	for (const provider of providers) {
		if (result.has(provider.namespace)) throw new Error(`Duplicate namespace provider: ${provider.namespace}`)
		result.set(provider.namespace, provider)
	}
	return immutableMap(result)
}

export async function resolveNamespace(providers: ReadonlyMap<NamespaceKey, NamespaceProvider>, namespace: NamespaceKey, identifier: string): Promise<ResolvedTarget | null> {
	const provider = providers.get(namespace)
	if (!provider) return null
	try {
		return await provider.resolve(identifier)
	} catch {
		return null
	}
}
