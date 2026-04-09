import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentLinks } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	// Pages that are not the target of any link
	const linkedIds = db
		.selectDistinct({ id: contentLinks.targetId })
		.from(contentLinks)
		.where(sql`${contentLinks.targetId} IS NOT NULL`)

	const orphans = await db
		.select({ domain: contentRecords.domain, slug: contentRecords.slug, title: contentRecords.title, parentPath: contentRecords.parentPath, updatedAt: contentRecords.updatedAt })
		.from(contentRecords)
		.where(
			sql`${contentRecords.id} NOT IN (${linkedIds})`,
		)
		.orderBy(contentRecords.domain, contentRecords.title)

	return { orphans }
}
