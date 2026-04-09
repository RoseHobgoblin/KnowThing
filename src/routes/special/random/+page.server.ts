import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const [randomPage] = await db
		.select({ domain: contentRecords.domain, slug: contentRecords.slug, parentPath: contentRecords.parentPath })
		.from(contentRecords)
		.orderBy(sql`RANDOM()`)
		.limit(1)

	if (randomPage) {
		const path = randomPage.parentPath
			? `/${randomPage.domain}/${randomPage.parentPath}/${randomPage.slug}`
			: `/${randomPage.domain}/${randomPage.slug}`
		throw redirect(302, path)
	}

	// No pages exist yet
	throw redirect(302, '/')
}
