import { error } from '@sveltejs/kit'
import { and, desc, eq, sql } from 'drizzle-orm'
import {
	calendars,
	celestialBodies,
	contentCategories,
	contentLinks,
	contentRecords,
	contentRevisions,
	languages,
	lexicon,
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
	// table when content_records misses, so /know/Therne still redirects to
	// /celestial/therne after the celestial shadow rows have been dropped.
	// Title links like [[Sunly system]] arrive wiki-slugified (spaces →
	// underscores), so match the underscored display name too.
	const lower = slug.toLowerCase()
	const [celestial] = await db
		.select({ slug: celestialBodies.slug })
		.from(celestialBodies)
		.where(sql`LOWER(${celestialBodies.slug}) = ${lower} OR LOWER(REPLACE(${celestialBodies.name}, ' ', '_')) = ${lower}`)
		.limit(1)
	if (celestial) return { domain: 'celestial', slug: celestial.slug, parentPath: null }

	// Wordbook languages — surface as /wordbook/<slug>.
	const [language] = await db
		.select({ slug: languages.slug })
		.from(languages)
		.where(sql`LOWER(${languages.slug}) = ${lower} OR LOWER(${languages.pageSlug}) = ${lower}`)
		.limit(1)
	if (language) return { domain: 'wordbook', slug: language.slug, parentPath: null }

	// Wordbook lexicon — surface as /wordbook/<lang>/<word>.
	const [word] = await db
		.select({ word: lexicon.word, languageId: lexicon.languageId })
		.from(lexicon)
		.where(sql`LOWER(${lexicon.word}) = ${lower} OR LOWER(${lexicon.pageSlug}) = ${lower}`)
		.limit(1)
	if (word) {
		const [parentLang] = await db
			.select({ slug: languages.slug })
			.from(languages)
			.where(eq(languages.id, word.languageId))
			.limit(1)
		if (parentLang) return { domain: 'wordbook', slug: word.word, parentPath: parentLang.slug }
	}

	const [calendar] = await db
		.select({ slug: calendars.slug })
		.from(calendars)
		.where(sql`LOWER(${calendars.slug}) = ${lower}`)
		.limit(1)
	if (calendar) return { domain: 'calendar', slug: calendar.slug, parentPath: null }

	return null
}
