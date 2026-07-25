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
import { resolveWordbookLanguageRead } from '$lib/server/services/entity-resolver.js'

export const load: PageServerLoad = async ({ params, url }) => {
	const query = url.searchParams.toString()

	// Reader flip: resolve the segment through ALL of the language's routes
	// (canonical or not) — former names keep working and 301 to the
	// canonical. Unrouted languages fall back to the legacy slug lookup.
	const routed = await resolveWordbookLanguageRead(params.language)
	if (routed?.needsRedirect) {
		redirect(301, `/Wordbook/${routed.canonicalSlug}${query ? `?${query}` : ''}`)
	}

	const lang = await getLanguageWithFamily(routed ? routed.language.slug : params.language)

	if (!lang) error(404, 'Language not found')

	if (!routed && lang.slug !== params.language) {
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
