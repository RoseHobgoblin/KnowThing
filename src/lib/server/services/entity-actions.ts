import { fail, redirect, type RequestEvent } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { requireEditor } from '$lib/server/guards.js'
import { saveEntityBody, type EntityKind } from '$lib/server/services/entity-article-loader.js'

const VALID_KINDS: ReadonlySet<string> = new Set([
	'star', 'body', 'system',
	'language', 'lexicon',
	'calendar', 'category', 'country', 'map',
])

export interface EntitySaveActionOptions {
	editSuffix?: RegExp
}

/**
 * Save action for structured-entity prose. Form must POST `entityKind`,
 * `entityId`, `title`, `content`, `summary`. Mirrors `articleSaveAction` but
 * writes to `<entity>.body` and snapshots into `entity_revisions`.
 */
export function entitySaveAction(options: EntitySaveActionOptions = {}) {
	const editSuffix = options.editSuffix ?? /\/(edit|configure)$/

	return async (event: RequestEvent) => {
		const user = requireEditor(event)
		const formData = await event.request.formData()
		const entityKind = formData.get('entityKind')?.toString() ?? ''
		const entityId = Number(formData.get('entityId'))
		const title = formData.get('title')?.toString().trim() ?? ''
		const content = formData.get('content')?.toString() ?? ''
		const editSummary = formData.get('summary')?.toString() ?? ''

		if (!VALID_KINDS.has(entityKind)) return fail(400, { error: `Invalid entity kind: ${entityKind}` })
		if (!entityId) return fail(400, { error: 'Missing entity id' })
		if (!title) return fail(400, { error: 'Missing title' })

		try {
			const result = await db.transaction(tx =>
				saveEntityBody(tx, {
					kind: entityKind as EntityKind,
					entityId,
					title,
					content,
					editSummary,
					userId: user.id,
				}),
			)
			if (!result.ok) return fail(result.status, { error: result.error })
		} catch {
			return fail(500, { error: 'Failed to save entity changes' })
		}

		const viewPath = event.url.pathname.replace(editSuffix, '')
		throw redirect(302, viewPath)
	}
}
