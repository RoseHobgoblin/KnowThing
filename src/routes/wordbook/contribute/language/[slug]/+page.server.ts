import type { PageServerLoad } from './$types.js'
import { redirect, error } from '@sveltejs/kit'
import {
	getLanguageRowBySlug,
	listLanguageOptionsExcluding,
} from '$lib/server/services/languages.js'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

	const lang = await getLanguageRowBySlug(params.slug)
	if (!lang) throw error(404, 'Language not found')

	const otherLanguages = await listLanguageOptionsExcluding(lang.id)
	return { language: lang, otherLanguages }
}
