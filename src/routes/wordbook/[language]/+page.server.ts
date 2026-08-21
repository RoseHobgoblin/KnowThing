import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { getAncestryChain, getChildren } from '$lib/feature/wordbook/public/server/language-tree.server.js'
import { listDialectsByLanguageId } from '$lib/feature/wordbook/public/server/dialects.server.js'
import { getInflectionsByLanguageId } from '$lib/feature/wordbook/public/server/inflections.server.js'
import {
	getLanguageWithFamily,
	listActiveLetters,
	listLanguageEntries,
} from '$lib/feature/wordbook/public/server/language-entries.server.js'

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
	const PAGE_SIZE = 200
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1') || 1)
	const [{ entries, total }, activeLetters] = await Promise.all([
		listLanguageEntries(lang.id, letter || null, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
		listActiveLetters(lang.id),
	])

	return {
		language: lang,
		entries,
		entriesTotal: total,
		entriesPage: page,
		entriesPageSize: PAGE_SIZE,
		ancestryChain,
		children,
		dialects,
		inflectionDimensions: inflections.dimensions,
		paradigmClasses: inflections.classes,
		activeLetters,
		currentLetter: letter,
	}
}
