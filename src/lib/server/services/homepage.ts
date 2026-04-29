import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	calendars,
	contentRecords,
	contentRevisions,
	languages,
	lexicon,
	media,
	users,
} from '$lib/server/db/schema.js'

export async function getRecentEdits(limit: number) {
	return db
		.select({
			pageSlug: contentRecords.slug,
			title: contentRevisions.title,
			editSummary: contentRevisions.editSummary,
			createdAt: contentRevisions.createdAt,
			userId: contentRevisions.userId,
		})
		.from(contentRevisions)
		.innerJoin(contentRecords, eq(contentRevisions.contentRecordId, contentRecords.id))
		.where(eq(contentRecords.domain, 'know'))
		.orderBy(desc(contentRevisions.createdAt))
		.limit(limit)
}

export async function getHomepageCounts() {
	const [
		[articleCount],
		[wordCount],
		[languageCount],
		[mediaCount],
		[userCount],
	] = await Promise.all([
		db.select({ value: count() }).from(contentRecords).where(eq(contentRecords.domain, 'know')),
		db.select({ value: count() }).from(lexicon),
		db.select({ value: count() }).from(languages),
		db.select({ value: count() }).from(media),
		db.select({ value: count() }).from(users),
	])
	return {
		articles: articleCount?.value ?? 0,
		words: wordCount?.value ?? 0,
		languages: languageCount?.value ?? 0,
		media: mediaCount?.value ?? 0,
		users: userCount?.value ?? 0,
	}
}

export async function getFeaturedArticle() {
	const [featured] = await db
		.select({ slug: contentRecords.slug, title: contentRecords.title, content: contentRecords.content })
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), sql`LENGTH(${contentRecords.content}) > 200`))
		.orderBy(desc(contentRecords.updatedAt))
		.limit(1)
	return featured ?? null
}

export async function getRandomWord() {
	const [{ value: total }] = await db.select({ value: count() }).from(lexicon)
	if (total === 0) return null

	const randomOffset = Math.floor(Math.random() * total)
	const [word] = await db
		.select({
			word: lexicon.word,
			languageName: languages.name,
			languageSlug: languages.slug,
			pronunciation: lexicon.pronunciation,
			definition: sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.offset(randomOffset)
		.limit(1)
	return word ?? null
}

export async function getPrimaryCalendarRow() {
	const [row] = await db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1)
	return row ?? null
}
