import type { PageServerLoad, Actions } from './$types.js'
import { requireAdmin } from '$lib/server/guards.js'
import { db } from '$lib/server/db/index.js'
import { pages, media } from '$lib/server/db/schema.js'

export const load: PageServerLoad = async (event) => {
	requireAdmin(event)

	// Just show the export page — actual download is via action
	const [[pageCount], [mediaCount]] = await Promise.all([
		db.select({ count: pages.id }).from(pages),
		db.select({ count: media.id }).from(media),
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
			.select({ slug: pages.slug, title: pages.title, content: pages.content })
			.from(pages)

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
