import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { hasRole } from '$lib/server/auth.js'
import { getLanguageWithFamily } from '$lib/server/services/wordbook.js'
import { entitySaveAction } from '$lib/server/services/entity-actions.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(`/Wordbook/${params.language}/edit`)}`)
	}
	if (!hasRole(locals.user.role, 'editor')) {
		throw redirect(302, `/Wordbook/${params.language}`)
	}

	const lang = await getLanguageWithFamily(params.language)
	if (!lang) error(404, 'Language not found')

	if (lang.slug !== params.language) {
		redirect(301, `/Wordbook/${lang.slug}/edit`)
	}

	return {
		entityId: lang.id,
		slug: lang.slug,
		title: lang.name,
		body: lang.body ?? '',
	}
}

export const actions: Actions = {
	default: entitySaveAction({ editSuffix: /\/edit$/ }),
}
