import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { hasRole } from '$lib/server/auth.js'
import { getLanguageBySlug, listHomographs } from '$lib/server/services/wordbook.js'
import { entitySaveAction } from '$lib/server/services/entity-actions.js'

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const editPath = `/wordbook/${params.language}/${params.word}/edit`
	if (!locals.user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(editPath)}`)
	}
	if (!hasRole(locals.user.role, 'editor')) {
		throw redirect(302, `/wordbook/${params.language}/${params.word}`)
	}

	const word = decodeURIComponent(params.word).normalize('NFC')
	const lang = await getLanguageBySlug(params.language)
	if (!lang) error(404, 'Language not found')

	const entries = await listHomographs(lang.id, word)
	if (entries.length === 0) error(404, `No entry for "${word}" in ${lang.name}`)

	// If multiple homographs, the editor edits the one specified by `?h=N` (default 1).
	const homographNum = Number(url.searchParams.get('h') ?? entries[0].homographNumber)
	const entry = entries.find(e => e.homographNumber === homographNum) ?? entries[0]

	return {
		entityId: entry.id,
		languageSlug: lang.slug,
		word: entry.word,
		title: entries.length > 1 ? `${entry.word} (${homographNum})` : entry.word,
		body: entry.body ?? '',
		isMultiple: entries.length > 1,
	}
}

export const actions: Actions = {
	default: entitySaveAction({ editSuffix: /\/edit$/ }),
}
