import { inArray } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { rodderBodies } from '$lib/feature/rodder/server/schema.server.js'

export type RodderMediaOwner = { ownerId: number, name: string, slug: string }

export async function describeRodderMediaOwners(ownerIds: number[]): Promise<RodderMediaOwner[]> {
	const ids = [...new Set(ownerIds.filter(id => Number.isInteger(id) && id > 0))]
	if (ids.length === 0) return []
	return db
		.select({ ownerId: rodderBodies.id, name: rodderBodies.name, slug: rodderBodies.slug })
		.from(rodderBodies)
		.where(inArray(rodderBodies.id, ids))
}
