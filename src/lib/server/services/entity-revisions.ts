import { db } from '../db/index.js'
import { entityRevisions } from '../db/schema.js'
import { and, eq, desc } from 'drizzle-orm'

export type EntityKind =
	| 'star'
	| 'body'
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
	// Live writes keep the legacy tuple; spine_consolidate_revisions() maps
	// the delta onto (entity_id, facet_key) at the writer flip.
	await db.insert(entityRevisions).values({
		legacyEntityType: entityType,
		legacyEntityId: entityId,
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
			eq(entityRevisions.legacyEntityType, entityType),
			eq(entityRevisions.legacyEntityId, entityId),
		))
		.orderBy(desc(entityRevisions.createdAt))
		.limit(limit)
}
