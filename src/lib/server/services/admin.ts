import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { updateContentEffects } from '$lib/server/content-effects.js'

export async function rebuildAllContentLinks() {
	const allRecords = await db
		.select({ id: contentRecords.id, domain: contentRecords.domain, content: contentRecords.content })
		.from(contentRecords)

	let rebuilt = 0
	for (const record of allRecords) {
		if (!record.content) continue
		await updateContentEffects(db, record.id, record.content, record.domain)
		rebuilt++
	}

	return { rebuilt, total: allRecords.length }
}
