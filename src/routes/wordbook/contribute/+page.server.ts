import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { hasRole } from '$lib/server/auth.js'
import { listLanguageOptions } from '$lib/server/services/languages.js'

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/auth/login')
	if (!hasRole(locals.user.role, 'editor')) throw error(403, 'Editor role required to contribute to the wordbook')

	const langs = await listLanguageOptions()
	const langSlug = url.searchParams.get('language')
	const preselectedLanguageId = langSlug
		? langs.find(l => l.slug === langSlug)?.id ?? null
		: null

	return { languages: langs, preselectedLanguageId }
}
