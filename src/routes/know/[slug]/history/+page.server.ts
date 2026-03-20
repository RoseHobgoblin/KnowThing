import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions, users } from '$lib/server/db/schema.js'
import { eq, desc } from 'drizzle-orm'
import { diffLines } from 'diff'
import { requireEditor } from '$lib/server/guards.js'

export const load: PageServerLoad = async (event) => {
	requireEditor(event)
	const { params, url } = event

	const [page] = await db
		.select({ title: pages.title, content: pages.content })
		.from(pages)
		.where(eq(pages.slug, params.slug))
		.limit(1)

	if (!page) throw error(404, 'Page not found')

	const history = await db
		.select({
			id: revisions.id,
			sizeBytes: revisions.sizeBytes,
			editSummary: revisions.editSummary,
			username: users.username,
			createdAt: revisions.createdAt,
		})
		.from(revisions)
		.leftJoin(users, eq(revisions.userId, users.id))
		.where(eq(revisions.pageSlug, params.slug))
		.orderBy(desc(revisions.createdAt))

	// Diff mode: ?diff=123&against=456
	const diffId = url.searchParams.get('diff')
	const againstId = url.searchParams.get('against')
	let diff: { added?: boolean, removed?: boolean, value: string }[] | null = null
	let diffOldLabel = ''
	let diffNewLabel = ''

	if (diffId && againstId) {
		const [oldRev] = await db
			.select({ content: revisions.content, createdAt: revisions.createdAt })
			.from(revisions)
			.where(eq(revisions.id, Number.parseInt(againstId)))
			.limit(1)

		const [newRev] = await db
			.select({ content: revisions.content, createdAt: revisions.createdAt })
			.from(revisions)
			.where(eq(revisions.id, Number.parseInt(diffId)))
			.limit(1)

		if (oldRev && newRev) {
			diff = diffLines(oldRev.content, newRev.content)
			diffOldLabel = new Date(oldRev.createdAt).toLocaleString()
			diffNewLabel = new Date(newRev.createdAt).toLocaleString()
		}
	}

	return { slug: params.slug, title: page.title, history, diff, diffOldLabel, diffNewLabel }
}
