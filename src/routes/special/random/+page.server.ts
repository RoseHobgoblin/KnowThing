import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	const [randomPage] = await db
		.select({ slug: contentRecords.slug })
		.from(contentRecords)
		.where(eq(contentRecords.domain, 'know'))
		.orderBy(sql`RANDOM()`)
		.limit(1)

	if (randomPage) {
		throw redirect(302, `/know/${randomPage.slug}`)
	}

	// No pages exist yet
	throw redirect(302, '/')
}
