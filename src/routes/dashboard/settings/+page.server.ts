import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { siteSettings } from '$lib/server/db/schema.js'

export const load: PageServerLoad = async () => {
	const rows = await db.select().from(siteSettings)
	const settings: Record<string, string> = {}
	for (const row of rows) settings[row.key] = row.value
	return { settings }
}
