import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { revisions, users } from '$lib/server/db/schema.js'
import { desc, eq } from 'drizzle-orm'

export const load: PageServerLoad = async ({ url }) => {
	const page = Number.parseInt(url.searchParams.get('page') ?? '1')
	const perPage = 20
	const offset = (page - 1) * perPage

	const edits = await db
		.select({
			id: revisions.id,
			pageSlug: revisions.pageSlug,
			title: revisions.title,
			editSummary: revisions.editSummary,
			sizeBytes: revisions.sizeBytes,
			createdAt: revisions.createdAt,
			username: users.username,
		})
		.from(revisions)
		.leftJoin(users, eq(revisions.userId, users.id))
		.orderBy(desc(revisions.createdAt))
		.limit(perPage)
		.offset(offset)

	return { edits, page, perPage }
}
