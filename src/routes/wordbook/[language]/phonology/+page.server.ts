import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { getAncestryChain } from '$lib/server/wordbook/language-tree.js'
import { getLanguageWithFamily } from '$lib/server/services/wordbook.js'
import { listPhonemesByLanguageId } from '$lib/server/services/phonemes.js'

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) throw redirect(302, `/auth/login?next=${encodeURIComponent(url.pathname)}`)

	const lang = await getLanguageWithFamily(params.language)
	if (!lang) throw error(404, 'Language not found')

	if (lang.slug !== params.language) {
		throw redirect(301, `/wordbook/${lang.slug}/phonology`)
	}

	const [ancestryChain, inventory] = await Promise.all([
		getAncestryChain(lang.id),
		listPhonemesByLanguageId(lang.id, null),
	])

	return { language: lang, ancestryChain, inventory }
}
