import type { FieldMap } from '$lib/infoboxes/types.js'
import {
	createStructuredCollectionProviders,
	createStructuredDataProviders,
	resolveStructuredCollectionDocument,
	resolveStructuredDocument,
	type StructuredCollection,
} from '$lib/structured-data/providers.js'
import {
	createRodderStructuredDataProviders,
	resolveRodderRootMapData,
	type RootMapData,
} from '$lib/feature/rodder/public/server/structured-data-provider.server.js'
import {
	wordbookStructuredCollectionProviders,
	wordbookStructuredDataProviders,
} from '$lib/feature/wordbook/public/server/structured-data-providers.server.js'
import { RODDER_CALENDAR_PORT } from './rodder-calendar-port.server.js'

export type { RootMapData } from '$lib/feature/rodder/public/server/structured-data-provider.server.js'
export type { StructuredCollection } from '$lib/structured-data/providers.js'

const STRUCTURED_DATA_PROVIDERS = createStructuredDataProviders([
	...createRodderStructuredDataProviders(RODDER_CALENDAR_PORT),
	...wordbookStructuredDataProviders,
])

const STRUCTURED_COLLECTION_PROVIDERS = createStructuredCollectionProviders(
	wordbookStructuredCollectionProviders,
)

export async function resolveStructuredData(infoboxType: string, slug: string): Promise<FieldMap | null> {
	return resolveStructuredDocument(STRUCTURED_DATA_PROVIDERS, infoboxType, slug)
}

export async function resolveAllStructuredData(
	references: { type: string, slug: string }[],
): Promise<Map<string, FieldMap>> {
	const result = new Map<string, FieldMap>()
	await Promise.all(references.map(async ({ type, slug }) => {
		const fields = await resolveStructuredData(type, slug)
		if (fields) result.set(slug, fields)
	}))
	return result
}

export async function resolveRootMapData(slug: string): Promise<RootMapData | null> {
	return resolveRodderRootMapData(slug, RODDER_CALENDAR_PORT)
}

export async function resolveAllRootMaps(slugs: string[]): Promise<Record<string, RootMapData>> {
	const result: Record<string, RootMapData> = {}
	await Promise.all(slugs.map(async (slug) => {
		const data = await resolveRootMapData(slug)
		if (data) result[slug] = data
	}))
	return result
}

export interface CollectionRef {
	type: string
	slug: string
}

export async function resolveStructuredCollection(
	type: string,
	slug: string,
): Promise<StructuredCollection | null> {
	return resolveStructuredCollectionDocument(STRUCTURED_COLLECTION_PROVIDERS, type, slug)
}

export async function resolveAllStructuredCollections(
	references: CollectionRef[],
): Promise<Map<string, StructuredCollection>> {
	const result = new Map<string, StructuredCollection>()
	await Promise.all(references.map(async ({ type, slug }) => {
		const rows = await resolveStructuredCollection(type, slug)
		if (rows) result.set(`${type}:${slug}`, rows)
	}))
	return result
}
