import { sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { rodderBodies } from '../../server/schema.server.js'
import {
	buildNamespaceHref,
	missingNamespaceTarget,
	type NamespaceProvider,
} from '$lib/namespaces/providers.js'

export const rodderNamespaceProvider: NamespaceProvider = {
	namespace: 'Rodder',
	async resolve(identifier) {
		const [entity] = await db
			.select({ id: rodderBodies.id, slug: rodderBodies.slug, name: rodderBodies.name, kind: rodderBodies.kind })
			.from(rodderBodies)
			.where(sql`LOWER(${rodderBodies.slug}) = ${identifier.toLowerCase()}`)
			.limit(1)
		if (!entity) return missingNamespaceTarget('Rodder', identifier)
		return {
			kind: `rodder-${entity.kind}`,
			href: buildNamespaceHref('Rodder', entity.slug),
			title: entity.name,
			exists: true,
			entityId: entity.id,
		}
	},
}
