import type { PageServerLoad } from './$types.js'
import { redirect } from '@sveltejs/kit'
import { listLanguageOptions } from '$lib/server/services/languages.js'

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

	const langs = await listLanguageOptions()
	const langSlug = url.searchParams.get('language')
	const preselectedLanguageId = langSlug
		? langs.find(l => l.slug === langSlug)?.id ?? null
		: null

	return { languages: langs, preselectedLanguageId }
}
