import { immutableMap } from '$lib/utils/immutable-map.js'

export type StructuredDocument = Map<string, string>

export interface StructuredDataProvider {
	kind: string
	resolve(identifier: string): Promise<StructuredDocument | null>
}

export type StructuredCollection = Record<string, unknown>[]

export interface StructuredCollectionProvider {
	kind: string
	resolve(identifier: string): Promise<StructuredCollection | null>
}

export function createStructuredDataProviders(providers: readonly StructuredDataProvider[]): ReadonlyMap<string, StructuredDataProvider> {
	const result = new Map<string, StructuredDataProvider>()
	for (const provider of providers) {
		if (result.has(provider.kind)) throw new Error(`Duplicate structured-data provider: ${provider.kind}`)
		result.set(provider.kind, provider)
	}
	return immutableMap(result)
}

export async function resolveStructuredDocument(providers: ReadonlyMap<string, StructuredDataProvider>, kind: string, identifier: string) {
	const provider = providers.get(kind)
	if (!provider) return null
	try {
		return await provider.resolve(identifier)
	} catch {
		return null
	}
}

export function createStructuredCollectionProviders(
	providers: readonly StructuredCollectionProvider[],
): ReadonlyMap<string, StructuredCollectionProvider> {
	const result = new Map<string, StructuredCollectionProvider>()
	for (const provider of providers) {
		if (result.has(provider.kind)) throw new Error(`Duplicate structured-collection provider: ${provider.kind}`)
		result.set(provider.kind, provider)
	}
	return immutableMap(result)
}

export async function resolveStructuredCollectionDocument(
	providers: ReadonlyMap<string, StructuredCollectionProvider>,
	kind: string,
	identifier: string,
): Promise<StructuredCollection | null> {
	const provider = providers.get(kind)
	if (!provider) return null
	try {
		return await provider.resolve(identifier)
	} catch {
		return null
	}
}
