import { sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { countries, worldMaps } from '../../server/schema.server.js'
import {
	buildNamespaceHref,
	missingNamespaceTarget,
	type NamespaceProvider,
} from '$lib/namespaces/providers.js'

export const countryNamespaceProvider: NamespaceProvider = {
	namespace: 'Country',
	async resolve(identifier) {
		const [country] = await db
			.select({ id: countries.id, slug: countries.slug, name: countries.name })
			.from(countries)
			.where(sql`LOWER(${countries.slug}) = ${identifier.toLowerCase()}`)
			.limit(1)
		return country
			? { kind: 'country', href: buildNamespaceHref('Country', country.slug), title: country.name, exists: true, entityId: country.id }
			: missingNamespaceTarget('Country', identifier)
	},
}

export const mapNamespaceProvider: NamespaceProvider = {
	namespace: 'Map',
	async resolve(identifier) {
		const [map] = await db
			.select({ id: worldMaps.id, slug: worldMaps.slug, name: worldMaps.name })
			.from(worldMaps)
			.where(sql`LOWER(${worldMaps.slug}) = ${identifier.toLowerCase()}`)
			.limit(1)
		return map
			? { kind: 'map', href: buildNamespaceHref('Map', map.slug), title: map.name, exists: true, entityId: map.id }
			: missingNamespaceTarget('Map', identifier)
	},
}
