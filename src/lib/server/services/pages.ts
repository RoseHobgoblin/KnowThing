import { error } from '@sveltejs/kit'
import { and, desc, eq, sql } from 'drizzle-orm'
import {
	contentCategories,
	contentLinks,
	contentRecords,
	contentRevisions,
	planetaryBodies,
	starSystems,
	stars,
	users,
} from '$lib/server/db/schema.js'
import { db } from '$lib/server/db/index.js'
import { deleteContentRecord } from '$lib/server/services/content-records.js'

export async function listPages() {
	return db
		.select({
			slug: contentRecords.slug,
			title: contentRecords.title,
			sizeBytes: contentRecords.sizeBytes,
			updatedAt: contentRecords.updatedAt,
		})
		.from(contentRecords)
		.where(eq(contentRecords.domain, 'know'))
		.orderBy(desc(contentRecords.updatedAt))
}

export async function getPage(domain: string, slug: string) {
	const [record] = await db
		.select()
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')
	return record
}

async function assertPage(domain: string, slug: string) {
	const [record] = await db
		.select({ id: contentRecords.id, title: contentRecords.title })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')
	return record
}

export async function deletePage(domain: string, slug: string) {
	const existing = await assertPage(domain, slug)
	await deleteContentRecord(db, existing.id)
	return { ok: true }
}

export async function getBacklinks(slug: string) {
	return db
		.select({
			slug: contentRecords.slug,
			title: contentRecords.title,
			domain: contentRecords.domain,
		})
		.from(contentLinks)
		.innerJoin(contentRecords, eq(contentLinks.sourceId, contentRecords.id))
		.where(sql`LOWER(${contentLinks.targetSlug}) = LOWER(${slug})`)
}

export async function getCategories(domain: string, slug: string) {
	const result = await db
		.select({ category: contentCategories.category })
		.from(contentCategories)
		.innerJoin(contentRecords, eq(contentCategories.contentRecordId, contentRecords.id))
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
		))

	return result.map(r => r.category)
}

export async function getPageHistory(domain: string, slug: string) {
	const record = await assertPage(domain, slug)

	return db
		.select({
			id: contentRevisions.id,
			title: contentRevisions.title,
			sizeBytes: contentRevisions.sizeBytes,
			editSummary: contentRevisions.editSummary,
			username: users.username,
			createdAt: contentRevisions.createdAt,
		})
		.from(contentRevisions)
		.leftJoin(users, eq(contentRevisions.userId, users.id))
		.where(eq(contentRevisions.contentRecordId, record.id))
		.orderBy(desc(contentRevisions.createdAt))
}

export async function getPageRevision(domain: string, slug: string, revisionId: number) {
	const record = await assertPage(domain, slug)

	const [rev] = await db
		.select()
		.from(contentRevisions)
		.where(and(eq(contentRevisions.id, revisionId), eq(contentRevisions.contentRecordId, record.id)))
		.limit(1)

	if (!rev) throw error(404, 'Revision not found')
	return rev
}

export async function loadPageForMove(domain: string, slug: string) {
	return assertPage(domain, slug)
}

export async function findPageCaseInsensitive(domain: string, slug: string) {
	const [record] = await db
		.select()
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, domain),
			sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`,
		))
		.limit(1)
	return record ?? null
}

export async function getPageForEdit(domain: string, slug: string) {
	const [record] = await db
		.select({
			id: contentRecords.id,
			slug: contentRecords.slug,
			title: contentRecords.title,
			content: contentRecords.content,
		})
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), eq(contentRecords.slug, slug)))
		.limit(1)

	if (!record) throw error(404, 'Page not found')
	return record
}

export async function getPageHistoryWithDiff(domain: string, slug: string, diffId: number | null, againstId: number | null) {
	const page = await assertPage(domain, slug)
	const pageWithContent = await db
		.select({ id: contentRecords.id, title: contentRecords.title, content: contentRecords.content })
		.from(contentRecords)
		.where(eq(contentRecords.id, page.id))

	const history = await db
		.select({
			id: contentRevisions.id,
			sizeBytes: contentRevisions.sizeBytes,
			editSummary: contentRevisions.editSummary,
			username: users.username,
			createdAt: contentRevisions.createdAt,
		})
		.from(contentRevisions)
		.leftJoin(users, eq(contentRevisions.userId, users.id))
		.where(eq(contentRevisions.contentRecordId, page.id))
		.orderBy(desc(contentRevisions.createdAt))

	let oldRev: { content: string, createdAt: Date } | null = null
	let newRev: { content: string, createdAt: Date } | null = null
	if (diffId != null && againstId != null) {
		const [oldRow] = await db
			.select({ content: contentRevisions.content, createdAt: contentRevisions.createdAt })
			.from(contentRevisions)
			.where(eq(contentRevisions.id, againstId))
			.limit(1)
		const [newRow] = await db
			.select({ content: contentRevisions.content, createdAt: contentRevisions.createdAt })
			.from(contentRevisions)
			.where(eq(contentRevisions.id, diffId))
			.limit(1)
		oldRev = oldRow ?? null
		newRev = newRow ?? null
	}

	return { page: pageWithContent[0]!, history, oldRev, newRev }
}

export async function findPageInAnyDomain(slug: string) {
	const [record] = await db
		.select({
			domain: contentRecords.domain,
			slug: contentRecords.slug,
			parentPath: contentRecords.parentPath,
		})
		.from(contentRecords)
		.where(sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`)
		.limit(1)
	if (record) return record

	// Phase 4+: structured entities own their pages. Probe the celestial
	// tables when content_records misses, so /know/Therne still redirects to
	// /celestial/therne after the celestial shadow rows have been dropped.
	const lower = slug.toLowerCase()
	const [system] = await db
		.select({ slug: starSystems.slug })
		.from(starSystems)
		.where(sql`LOWER(${starSystems.slug}) = ${lower} OR LOWER(${starSystems.pageSlug}) = ${lower}`)
		.limit(1)
	if (system) return { domain: 'celestial', slug: system.slug, parentPath: null }

	const [star] = await db
		.select({ slug: stars.slug })
		.from(stars)
		.where(sql`LOWER(${stars.slug}) = ${lower} OR LOWER(${stars.pageSlug}) = ${lower}`)
		.limit(1)
	if (star) return { domain: 'celestial', slug: star.slug, parentPath: null }

	const [planet] = await db
		.select({ slug: planetaryBodies.slug })
		.from(planetaryBodies)
		.where(sql`LOWER(${planetaryBodies.slug}) = ${lower} OR LOWER(${planetaryBodies.pageSlug}) = ${lower}`)
		.limit(1)
	if (planet) return { domain: 'celestial', slug: planet.slug, parentPath: null }

	return null
}
