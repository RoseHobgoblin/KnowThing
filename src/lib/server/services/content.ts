import { error } from '@sveltejs/kit'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import {
	createContentRecord,
	moveContentRecord,
	saveContentRecord,
	type ContentRecord,
} from '$lib/server/services/content-records.js'
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

export async function createKnowPage(input: CreateKnowPageInput): Promise<ContentRecord> {
	const title = input.title.trim()
	const slug = normalizeKnowSlug(title, input.slug)

	await assertNoCrossDomainSlugCollision(slug)
	await assertNoKnowSlugConflict(slug)

	return db.transaction(tx => createContentRecord(tx, {
		domain: 'know',
		slug,
		title,
		content: input.content,
		editSummary: 'Page created',
		userId: input.userId,
	}))
}

export async function updateKnowPage(input: UpdateKnowPageInput): Promise<ContentRecord> {
	const existing = await getKnowPageRecord(input.slug)
	if (!existing) throw error(404, 'Page not found')

	const result = await db.transaction(tx => saveContentRecord(tx, {
		contentRecordId: existing.id,
		content: input.content,
		editSummary: input.editSummary || '',
		userId: input.userId,
		title: input.title,
	}))

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

	return db.transaction(tx => moveContentRecord(tx, {
		contentRecordId: existing.id,
		newSlug,
		newTitle,
		userId: input.userId,
	}))
}
