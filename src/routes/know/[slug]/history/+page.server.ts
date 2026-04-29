import type { PageServerLoad } from './$types.js'
import { diffLines } from 'diff'
import { requireEditor } from '$lib/server/guards.js'
import { getPageHistoryWithDiff } from '$lib/server/services/pages.js'

export const load: PageServerLoad = async (event) => {
	requireEditor(event)
	const { params, url } = event

	const diffId = url.searchParams.get('diff')
	const againstId = url.searchParams.get('against')
	const { page, history, oldRev, newRev } = await getPageHistoryWithDiff(
		'know',
		params.slug,
		diffId ? Number.parseInt(diffId) : null,
		againstId ? Number.parseInt(againstId) : null,
	)

	let diff: { added?: boolean, removed?: boolean, value: string }[] | null = null
	let diffOldLabel = ''
	let diffNewLabel = ''
	if (oldRev && newRev) {
		diff = diffLines(oldRev.content, newRev.content)
		diffOldLabel = new Date(oldRev.createdAt).toLocaleString()
		diffNewLabel = new Date(newRev.createdAt).toLocaleString()
	}

	return { slug: params.slug, title: page.title, history, diff, diffOldLabel, diffNewLabel }
}
