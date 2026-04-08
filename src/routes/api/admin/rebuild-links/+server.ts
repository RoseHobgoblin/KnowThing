import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { updateContentEffects } from '$lib/server/content-effects.js'
import { requireRole } from '$lib/server/auth.js'

/** POST /api/admin/rebuild-links — rebuild contentLinks for all content records */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const allRecords = await db
		.select({ id: contentRecords.id, domain: contentRecords.domain, content: contentRecords.content })
		.from(contentRecords)

	let rebuilt = 0
	for (const record of allRecords) {
		if (!record.content) continue
		await updateContentEffects(db, record.id, record.content, record.domain)
		rebuilt++
	}

	return json({ rebuilt, total: allRecords.length })
}
