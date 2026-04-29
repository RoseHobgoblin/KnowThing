import type { PageServerLoad, Actions } from './$types.js'
import { requireAdmin } from '$lib/server/guards.js'
import { exportKnowPages, getKnowExportSummary } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async (event) => {
	requireAdmin(event)
	return getKnowExportSummary()
}

export const actions: Actions = {
	default: async (event) => {
		requireAdmin(event)

		const allPages = await exportKnowPages()

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
