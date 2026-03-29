import type { PageServerLoad, Actions } from './$types.js'
import { requireAdmin } from '$lib/server/guards.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, media } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'

export const load: PageServerLoad = async (event) => {
	requireAdmin(event)

	// Just show the export page — actual download is via action
	const [[pageCount], [mediaCount]] = await Promise.all([
		db.select({ count: sql<number>`count(*)::int` }).from(contentRecords).where(eq(contentRecords.domain, 'know')),
		db.select({ count: sql<number>`count(*)::int` }).from(media),
	])

	return {
		pageCount: pageCount?.count ?? 0,
		mediaCount: mediaCount?.count ?? 0,
	}
}

export const actions: Actions = {
	default: async (event) => {
		requireAdmin(event)

		const allPages = await db
			.select({ slug: contentRecords.slug, title: contentRecords.title, content: contentRecords.content })
			.from(contentRecords)
			.where(eq(contentRecords.domain, 'know'))

		// Build a simple JSON export (ZIP would need archiver package)
		const exportData = {
			exportedAt: new Date().toISOString(),
			version: 1,
			pages: allPages.map(p => ({
				slug: p.slug,
				title: p.title,
				content: p.content,
			})),
		}

		return {
			download: JSON.stringify(exportData, null, 2),
			filename: `knowthing-export-${new Date().toISOString().slice(0, 10)}.json`,
		}
	},
}
