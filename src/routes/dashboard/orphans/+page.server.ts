import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, links } from '$lib/server/db/schema.js'
import { notInArray } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const linkedSlugs = db.selectDistinct({ slug: links.targetSlug }).from(links)

	const orphans = await db
		.select({ slug: pages.slug, title: pages.title, updatedAt: pages.updatedAt })
		.from(pages)
		.where(notInArray(pages.slug, linkedSlugs))
		.orderBy(pages.title)

	return { orphans }
}
