import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, contentRevisions, users } from '$lib/server/db/schema.js'
import { desc, eq } from 'drizzle-orm'

export const load: PageServerLoad = async ({ url }) => {
	const page = Number.parseInt(url.searchParams.get('page') ?? '1')
	const perPage = 20
	const offset = (page - 1) * perPage

	const edits = await db
		.select({
			id: contentRevisions.id,
			domain: contentRecords.domain,
			pageSlug: contentRecords.slug,
			parentPath: contentRecords.parentPath,
			title: contentRevisions.title,
			editSummary: contentRevisions.editSummary,
			sizeBytes: contentRevisions.sizeBytes,
			createdAt: contentRevisions.createdAt,
			username: users.username,
		})
		.from(contentRevisions)
		.innerJoin(contentRecords, eq(contentRevisions.contentRecordId, contentRecords.id))
		.leftJoin(users, eq(contentRevisions.userId, users.id))
		.orderBy(desc(contentRevisions.createdAt))
		.limit(perPage)
		.offset(offset)

	return { edits, page, perPage }
}
