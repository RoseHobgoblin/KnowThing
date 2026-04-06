import { error } from '@sveltejs/kit'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentLinks, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { updateContentEffects, backfillLinkTargets } from '$lib/server/content-effects.js'
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

export async function createKnowPage(input: CreateKnowPageInput) {
	const title = input.title.trim()
	const content = input.content
	const slug = normalizeKnowSlug(title, input.slug)
	const sizeBytes = new TextEncoder().encode(content).length

	await assertNoCrossDomainSlugCollision(slug)
	await assertNoKnowSlugConflict(slug)

	return db.transaction(async (tx) => {
		const [record] = await tx
			.insert(contentRecords)
			.values({ domain: 'know', slug, title, content, plainText: '', sizeBytes })
			.returning()

		const { plainText, ast } = await updateContentEffects(tx, record.id, content)

		const [updated] = await tx
			.update(contentRecords)
			.set({ plainText, parsedAst: ast })
			.where(eq(contentRecords.id, record.id))
			.returning()

		await tx.insert(contentRevisions).values({
			contentRecordId: record.id,
			title,
			content,
			sizeBytes,
			editSummary: 'Page created',
			userId: input.userId,
		})

		// Backfill any existing red links pointing at this new page
		await backfillLinkTargets(tx, record.id, 'know', slug)

		return updated
	})
}

export async function updateKnowPage(input: UpdateKnowPageInput) {
	const existing = await getKnowPageRecord(input.slug)
	if (!existing) {
		throw error(404, 'Page not found')
	}

	const title = input.title?.trim() || existing.title
	const content = input.content
	const sizeBytes = new TextEncoder().encode(content).length

	return db.transaction(async (tx) => {
		const { plainText, ast } = await updateContentEffects(tx, existing.id, content)

		const [updated] = await tx
			.update(contentRecords)
			.set({
				title,
				content,
				plainText,
				parsedAst: ast,
				sizeBytes,
				updatedAt: new Date(),
			})
			.where(eq(contentRecords.id, existing.id))
			.returning()

		await tx.insert(contentRevisions).values({
			contentRecordId: existing.id,
			title: updated.title,
			content,
			sizeBytes,
			editSummary: input.editSummary || '',
			userId: input.userId,
		})

		return updated
	})
}

export async function moveKnowPage(input: MoveKnowPageInput) {
	const existing = await getKnowPageRecord(input.slug)
	if (!existing) {
		throw error(404, 'Page not found')
	}

	const newTitle = input.newTitle.trim()
	const newSlug = normalizeKnowSlug(newTitle, input.newSlug)

	await assertNoCrossDomainSlugCollision(newSlug, existing.id)
	if (newSlug !== existing.slug) {
		await assertNoKnowSlugConflict(newSlug, existing.id)
	}

	return db.transaction(async (tx) => {
		await tx.insert(contentRevisions).values({
			contentRecordId: existing.id,
			title: newTitle,
			content: existing.content,
			sizeBytes: existing.sizeBytes,
			editSummary: `Moved from "${existing.title}" (${existing.slug}) to "${newTitle}" (${newSlug})`,
			userId: input.userId,
		})

		const [updated] = await tx
			.update(contentRecords)
			.set({ slug: newSlug, title: newTitle, updatedAt: new Date() })
			.where(eq(contentRecords.id, existing.id))
			.returning()

		// Update targetId on inbound links so they resolve to the moved record.
		// Do NOT rewrite targetSlug — it must stay matching the source wikitext
		// so the renderer's slug-based lookup still finds the entry.
		await tx
			.update(contentLinks)
			.set({ targetId: existing.id })
			.where(and(eq(contentLinks.targetDomain, 'know'), eq(contentLinks.targetSlug, existing.slug)))

		await updateContentEffects(tx, existing.id, existing.content, 'know')

		return updated
	})
}
