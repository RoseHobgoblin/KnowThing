import { db } from '../db/index.js'
import { entityRevisions } from '../db/schema.js'
import { and, eq, desc } from 'drizzle-orm'

export type EntityKind =
	| 'star'
	| 'planet'
	| 'system'
	| 'language'
	| 'lexicon'
	| 'calendar'
	| 'category'
	| 'country'
	| 'map'

export interface EntityRevisionSnapshot {
	title: string
	body: string
	bodySizeBytes: number
	editSummary?: string
}

export async function recordEntityRevision(
	entityType: EntityKind,
	entityId: number,
	snapshot: EntityRevisionSnapshot,
	userId: number | null,
): Promise<void> {
	await db.insert(entityRevisions).values({
		entityType,
		entityId,
		title: snapshot.title,
		snapshot,
		editSummary: snapshot.editSummary ?? null,
		userId: userId ?? null,
	})
}

export async function listEntityRevisions(
	entityType: EntityKind,
	entityId: number,
	limit = 50,
) {
	return db
		.select()
		.from(entityRevisions)
		.where(and(
			eq(entityRevisions.entityType, entityType),
			eq(entityRevisions.entityId, entityId),
		))
		.orderBy(desc(entityRevisions.createdAt))
		.limit(limit)
}
