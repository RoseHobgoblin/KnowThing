import { fail, redirect, type RequestEvent } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { requireEditor } from '$lib/server/guards.js'
import { saveContentRecord } from '$lib/server/services/content-records.js'

export interface ArticleSaveActionOptions {
	/** Trailing path segments (e.g. /^\/(edit|configure)$/) stripped to compute the canonical view URL after save. */
	editSuffix?: RegExp
}

/**
 * Factory for the standard "save wiki article" form action used by every
 * article-bearing route (rodder, calendar, know, worldmap, …).
 *
 * The form must POST `contentRecordId`, `content`, and `summary`.
 */
export function articleSaveAction(options: ArticleSaveActionOptions = {}) {
	const editSuffix = options.editSuffix ?? /\/(edit|configure)$/

	return async (event: RequestEvent) => {
		const user = requireEditor(event)
		const formData = await event.request.formData()
		const contentRecordId = Number(formData.get('contentRecordId'))
		const content = formData.get('content')?.toString() ?? ''
		const editSummary = formData.get('summary')?.toString() ?? ''

		if (!contentRecordId) return fail(400, { error: 'Missing content record ID' })

		try {
			const result = await db.transaction(tx =>
				saveContentRecord(tx, { contentRecordId, content, editSummary, userId: user.id }),
			)
			if (!result.ok) return fail(result.status, { error: result.error })
		} catch {
			return fail(500, { error: 'Failed to save article changes' })
		}

		const viewPath = event.url.pathname.replace(editSuffix, '')
		throw redirect(302, viewPath)
	}
}
