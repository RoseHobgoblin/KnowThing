import type { RodderEntityDocument, RodderSectorDocument } from './consumer-contract.js'

export const RODDER_ENTITY_RESOURCE = 'rodder:entities'
export const RODDER_SECTOR_RESOURCE = 'rodder:sectors'

function mapResource<T>(resources: ReadonlyMap<string, unknown>, key: string): ReadonlyMap<string, T | null> | null {
	const value = resources.get(key)
	return value instanceof Map ? value as ReadonlyMap<string, T | null> : null
}

export function rodderEntityResources(resources: ReadonlyMap<string, unknown>) {
	return mapResource<RodderEntityDocument>(resources, RODDER_ENTITY_RESOURCE)
}

export function rodderSectorResources(resources: ReadonlyMap<string, unknown>) {
	return mapResource<RodderSectorDocument>(resources, RODDER_SECTOR_RESOURCE)
}
