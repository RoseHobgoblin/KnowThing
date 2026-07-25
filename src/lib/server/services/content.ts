import { error } from '@sveltejs/kit'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentRecords, entities } from '$lib/server/db/schema.js'
import {
	createContentRecord,
	moveContentRecord,
	saveContentRecord,
	type ContentRecord,
} from '$lib/server/services/content-records.js'
import {
	mintOrAttachFacetEntity,
	repointCanonicalRoute,
	type EntitySpineDatabase,
} from '$lib/server/services/entity-spine.js'
import { slugify } from '$lib/renderer/context.js'

export interface CreateKnowPageInput {
	title: string
	content: string
	slug?: string
	userId: number
}

export interface UpdateKnowPageInput {
	slug: string
	content: string
	title?: string
	editSummary?: string
	userId: number
}

export interface MoveKnowPageInput {
	slug: string
	newTitle: string
	newSlug?: string
	userId: number
}

function normalizeKnowSlug(title: string, rawSlug?: string): string {
	const candidate = rawSlug?.trim() || slugify(title)
	return slugify(candidate)
}

async function getKnowPageRecord(slug: string) {
	const [record] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(contentRecords.slug, slug)))
		.limit(1)

	return record ?? null
}

async function assertNoCrossDomainSlugCollision(slug: string, excludedRecordId?: number): Promise<void> {
	const conditions = [
		sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
		ne(contentRecords.domain, 'know'),
	]

	if (excludedRecordId !== undefined) {
		conditions.push(ne(contentRecords.id, excludedRecordId))
	}

	const [collision] = await db
		.select({ domain: contentRecords.domain })
		.from(contentRecords)
		.where(and(...conditions))
		.limit(1)

	if (collision) {
		throw error(409, `A ${collision.domain} entry with this slug already exists`)
	}
}

async function assertNoKnowSlugConflict(slug: string, excludedRecordId?: number): Promise<void> {
	const conditions = [
		eq(contentRecords.domain, 'know'),
		eq(contentRecords.slug, slug),
	]

	if (excludedRecordId !== undefined) {
		conditions.push(ne(contentRecords.id, excludedRecordId))
	}

	const [conflict] = await db
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(...conditions))
		.limit(1)

	if (conflict) {
		throw error(409, 'A page with that slug already exists')
	}
}

async function hasArticleFacet(tx: EntitySpineDatabase, entityId: number): Promise<boolean> {
	const [row] = await tx
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(eq(contentRecords.entityId, entityId))
		.limit(1)
	return !!row
}

export async function createKnowPage(input: CreateKnowPageInput): Promise<ContentRecord> {
	const title = input.title.trim()
	const slug = normalizeKnowSlug(title, input.slug)

	await assertNoCrossDomainSlugCollision(slug)
	await assertNoKnowSlugConflict(slug)

	return db.transaction(async (tx) => {
		const record = await createContentRecord(tx, {
			domain: 'know',
			slug,
			title,
			content: input.content,
			editSummary: 'Page created',
			userId: input.userId,
		})

		// Compatibility writer (0049): every new page is a spine entity with a
		// canonical route — or the article facet of an existing one.
		const { entityId } = await mintOrAttachFacetEntity(tx, {
			displayName: title,
			namespace: 'know',
			slug,
			hasFacet: id => hasArticleFacet(tx, id),
		})
		const [attached] = await tx
			.update(contentRecords)
			.set({ entityId })
			.where(eq(contentRecords.id, record.id))
			.returning()
		return attached
	})
}

export async function updateKnowPage(input: UpdateKnowPageInput): Promise<ContentRecord> {
	const existing = await getKnowPageRecord(input.slug)
	if (!existing) throw error(404, 'Page not found')

	const result = await db.transaction(async (tx) => {
		const saved = await saveContentRecord(tx, {
			contentRecordId: existing.id,
			content: input.content,
			editSummary: input.editSummary || '',
			userId: input.userId,
			title: input.title,
		})

		// Keep the spine's display identity in step with a title edit.
		if (saved.ok && existing.entityId != null && saved.record.title !== existing.title) {
			await tx
				.update(entities)
				.set({ displayName: saved.record.title, updatedAt: new Date() })
				.where(eq(entities.id, existing.entityId))
		}
		return saved
	})

	if (!result.ok) throw error(result.status, result.error)
	return result.record
}

export async function moveKnowPage(input: MoveKnowPageInput): Promise<ContentRecord> {
	const existing = await getKnowPageRecord(input.slug)
	if (!existing) throw error(404, 'Page not found')

	const newTitle = input.newTitle.trim()
	const newSlug = normalizeKnowSlug(newTitle, input.newSlug)

	await assertNoCrossDomainSlugCollision(newSlug, existing.id)
	if (newSlug !== existing.slug) {
		await assertNoKnowSlugConflict(newSlug, existing.id)
	}

	return db.transaction(async (tx) => {
		const moved = await moveContentRecord(tx, {
			contentRecordId: existing.id,
			newSlug,
			newTitle,
			userId: input.userId,
		})

		// A move is a rename: demote the old canonical route (it 301s forever),
		// promote/insert the new address. Pre-spine pages (entityId NULL) are
		// left for the backfill phase.
		if (existing.entityId != null) {
			await repointCanonicalRoute(tx, existing.entityId, {
				namespace: 'know',
				slug: newSlug,
				displayName: newTitle,
			})
		}
		return moved
	})
}
