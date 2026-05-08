import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { getAncestryChain, getChildren } from '$lib/server/wordbook/language-tree.js'
import { listDialectsByLanguageId } from '$lib/server/services/dialects.js'
import { getInflectionsByLanguageId } from '$lib/server/services/inflections.js'
import {
	getLanguageWithFamily,
	listActiveLetters,
	listLanguageEntries,
} from '$lib/server/services/wordbook.js'
import { getResolvedLinks, serializeResolvedLinks } from '$lib/server/resolved-links.js'

export const load: PageServerLoad = async ({ params, url }) => {
	const lang = await getLanguageWithFamily(params.language)

	if (!lang) error(404, 'Language not found')

	if (lang.slug !== params.language) {
		const query = url.searchParams.toString()
		redirect(301, `/Wordbook/${lang.slug}${query ? `?${query}` : ''}`)
	}

	const [ancestryChain, children, dialects, inflections] = await Promise.all([
		getAncestryChain(lang.id),
		getChildren(lang.id),
		listDialectsByLanguageId(lang.id),
		getInflectionsByLanguageId(lang.id),
	])

	const letter = url.searchParams.get('letter') || ''
	const entries = await listLanguageEntries(lang.id, letter || null)
	const activeLetters = await listActiveLetters(lang.id)
	const resolvedLinks = await getResolvedLinks({ kind: 'language', entityId: lang.id })

	return {
		language: lang,
		entries,
		ancestryChain,
		children,
		dialects,
		inflectionDimensions: inflections.dimensions,
		paradigmClasses: inflections.classes,
		activeLetters,
		currentLetter: letter,
		resolvedLinks: serializeResolvedLinks(resolvedLinks),
	}
}
