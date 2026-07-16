import { error } from '@sveltejs/kit'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentLinks, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import {
	backfillLinkTargets,
	deleteContentEffects,
	updateContentEffects,
} from '$lib/server/content-effects.js'
import type { WikiNode } from '$lib/parser/types.js'

export type ContentRecordsDatabase = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

export type ContentRecord = typeof contentRecords.$inferSelect

function byteLength(content: string): number {
	return new TextEncoder().encode(content).length
}

export interface LoadedContent {
	wikiContent: string
	ast: WikiNode | null
	contentRecordId: number | null
	rawContent?: string
}

const EMPTY_CONTENT: LoadedContent = { wikiContent: '', ast: null, contentRecordId: null }

export async function loadContentRecord(contentRecordId: number | null): Promise<LoadedContent> {
	if (!contentRecordId) return EMPTY_CONTENT

	const [record] = await db
		.select({ id: contentRecords.id, content: contentRecords.content, parsedAst: contentRecords.parsedAst })
		.from(contentRecords)
		.where(eq(contentRecords.id, contentRecordId))

	if (!record) return EMPTY_CONTENT

	return {
		wikiContent: record.content,
		ast: record.parsedAst as WikiNode | null,
		contentRecordId: record.id,
		rawContent: record.content,
	}
}

export async function loadContentByDomainSlug(domain: string, slug: string): Promise<LoadedContent> {
	const [record] = await db
		.select({ id: contentRecords.id, content: contentRecords.content, parsedAst: contentRecords.parsedAst })
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
		))

	if (!record) return EMPTY_CONTENT

	return {
		wikiContent: record.content,
		ast: record.parsedAst as WikiNode | null,
		contentRecordId: record.id,
		rawContent: record.content,
	}
}

export interface EnsureContentRecordInput {
	domain: string
	slug: string
	title: string
	parentPath: string | null
	contentRecordId: number | null
	attach: (contentRecordId: number) => Promise<void>
}

async function findExistingRecord(
	database: ContentRecordsDatabase,
	domain: string,
	slug: string,
	parentPath: string | null,
) {
	const [existing] = await database
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, domain),
			eq(contentRecords.slug, slug),
			parentPath === null ? isNull(contentRecords.parentPath) : eq(contentRecords.parentPath, parentPath),
		))

	return existing ?? null
}

export async function ensureContentRecord(
	database: ContentRecordsDatabase,
	input: EnsureContentRecordInput,
): Promise<number> {
	let recordId = input.contentRecordId

	if (recordId) {
		const [existingById] = await database
			.select({ id: contentRecords.id })
			.from(contentRecords)
			.where(eq(contentRecords.id, recordId))

		if (!existingById) recordId = null
	}

	if (recordId) {
		await database
			.update(contentRecords)
			.set({
				title: input.title,
				slug: input.slug,
				parentPath: input.parentPath,
				updatedAt: new Date(),
			})
			.where(eq(contentRecords.id, recordId))
		return recordId
	}

	const existing = await findExistingRecord(database, input.domain, input.slug, input.parentPath)
	if (existing) {
		recordId = existing.id
		await database
			.update(contentRecords)
			.set({
				title: input.title,
				slug: input.slug,
				parentPath: input.parentPath,
				updatedAt: new Date(),
			})
			.where(eq(contentRecords.id, recordId))
	} else {
		const [created] = await database
			.insert(contentRecords)
			.values({
				domain: input.domain,
				slug: input.slug,
				parentPath: input.parentPath,
				title: input.title,
				content: '',
				plainText: '',
				sizeBytes: 0,
			})
			.returning({ id: contentRecords.id })

		recordId = created.id
		await backfillLinkTargets(database, recordId, input.domain, input.slug)
	}

	await input.attach(recordId)
	return recordId
}

export interface CreateContentRecordInput {
	domain: string
	slug: string
	title: string
	parentPath?: string | null
	content: string
	editSummary: string
	userId: number | null
}

export async function createContentRecord(
	database: ContentRecordsDatabase,
	input: CreateContentRecordInput,
): Promise<ContentRecord> {
	const sizeBytes = byteLength(input.content)

	const [record] = await database
		.insert(contentRecords)
		.values({
			domain: input.domain,
			slug: input.slug,
			parentPath: input.parentPath ?? null,
			title: input.title,
			content: input.content,
			plainText: '',
			sizeBytes,
		})
		.returning()

	const { plainText, ast } = await updateContentEffects(database, record.id, input.content, input.domain)

	const [updated] = await database
		.update(contentRecords)
		.set({ plainText, parsedAst: ast })
		.where(eq(contentRecords.id, record.id))
		.returning()

	await database.insert(contentRevisions).values({
		contentRecordId: record.id,
		title: input.title,
		content: input.content,
		sizeBytes,
		editSummary: input.editSummary,
		userId: input.userId,
	})

	await backfillLinkTargets(database, record.id, input.domain, input.slug)

	return updated
}

export interface SaveContentRecordInput {
	contentRecordId: number
	content: string
	editSummary: string
	userId: number
	title?: string
}

export type SaveContentRecordResult =
	| { ok: true, record: ContentRecord }
	| { ok: false, status: number, error: string }

export async function saveContentRecord(
	database: ContentRecordsDatabase,
	input: SaveContentRecordInput,
): Promise<SaveContentRecordResult> {
	const [existing] = await database
		.select()
		.from(contentRecords)
		.where(eq(contentRecords.id, input.contentRecordId))

	if (!existing) return { ok: false, status: 404, error: 'Content record not found' }

	const title = input.title?.trim() || existing.title
	const sizeBytes = byteLength(input.content)
	const { plainText, ast } = await updateContentEffects(database, existing.id, input.content, existing.domain)

	const [updated] = await database
		.update(contentRecords)
		.set({
			title,
			content: input.content,
			plainText,
			parsedAst: ast,
			sizeBytes,
			updatedAt: new Date(),
		})
		.where(eq(contentRecords.id, existing.id))
		.returning()

	await database.insert(contentRevisions).values({
		contentRecordId: existing.id,
		title,
		content: input.content,
		sizeBytes,
		editSummary: input.editSummary,
		userId: input.userId,
	})

	return { ok: true, record: updated }
}

export interface MoveContentRecordInput {
	contentRecordId: number
	newSlug: string
	newTitle: string
	editSummaryFn?: (oldSlug: string, oldTitle: string) => string
	userId: number
}

export async function moveContentRecord(
	database: ContentRecordsDatabase,
	input: MoveContentRecordInput,
): Promise<ContentRecord> {
	const [existing] = await database
		.select()
		.from(contentRecords)
		.where(eq(contentRecords.id, input.contentRecordId))

	if (!existing) throw error(404, 'Content record not found')

	const editSummary = input.editSummaryFn?.(existing.slug, existing.title)
		?? `Moved from "${existing.title}" (${existing.slug}) to "${input.newTitle}" (${input.newSlug})`

	await database.insert(contentRevisions).values({
		contentRecordId: existing.id,
		title: input.newTitle,
		content: existing.content,
		sizeBytes: existing.sizeBytes,
		editSummary,
		userId: input.userId,
	})

	const [updated] = await database
		.update(contentRecords)
		.set({ slug: input.newSlug, title: input.newTitle, updatedAt: new Date() })
		.where(eq(contentRecords.id, existing.id))
		.returning()

	// Inbound links keyed by the OLD slug retain their slug (the source wikitext
	// still says [[oldSlug]]) but get re-pointed at this record so they keep
	// resolving. See note in former moveKnowPage.
	await database
		.update(contentLinks)
		.set({ targetId: existing.id })
		.where(and(
			eq(contentLinks.targetDomain, existing.domain),
			sql`LOWER(${contentLinks.targetSlug}) = LOWER(${existing.slug})`,
		))

	await updateContentEffects(database, existing.id, existing.content, existing.domain)

	return updated
}

/**
 * Re-key a legacy content record when its owning entity's slug changes.
 * No-op when the domain+slug pair has no content record (post-Phase-4
 * entities keep their prose on the entity row itself).
 */
export async function moveContentByDomainSlug(
	database: ContentRecordsDatabase,
	domain: string,
	oldSlug: string,
	newSlug: string,
): Promise<void> {
	await database
		.update(contentRecords)
		.set({ slug: newSlug, updatedAt: new Date() })
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${oldSlug})`,
		))
}

export async function deleteContentRecord(
	database: ContentRecordsDatabase,
	contentRecordId: number | null,
): Promise<void> {
	if (!contentRecordId) return

	await deleteContentEffects(database, contentRecordId)
	await database.delete(contentRecords).where(eq(contentRecords.id, contentRecordId))
}

export async function deleteContentByDomainSlug(
	database: ContentRecordsDatabase,
	domain: string,
	slug: string,
): Promise<void> {
	const [record] = await database
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
		))
	if (!record) return

	await deleteContentEffects(database, record.id)
	await database.delete(contentRecords).where(eq(contentRecords.id, record.id))
}
