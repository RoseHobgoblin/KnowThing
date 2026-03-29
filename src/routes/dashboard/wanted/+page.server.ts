import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentLinks } from '$lib/server/db/schema.js'
import { sql, isNull, eq } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	// Find link targets that don't have a corresponding content record
	// contentLinks.targetId is null when the target page doesn't exist
	const wanted = await db
		.select({
			slug: contentLinks.targetSlug,
			linkCount: sql<number>`count(*)::int`,
		})
		.from(contentLinks)
		.where(
			sql`${contentLinks.targetId} IS NULL AND ${contentLinks.targetDomain} = 'know'`,
		)
		.groupBy(contentLinks.targetSlug)
		.orderBy(sql`count(*) DESC`)
		.limit(50)

	return { wanted }
}
