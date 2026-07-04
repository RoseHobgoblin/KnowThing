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
import { extractCollectionRefs, parseWikitext } from '$lib/parser/index.js'
import { resolveAllStructuredCollections } from '$lib/server/structured-data.js'
import type { WikiNode } from '$lib/parser/types.js'

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
	const [{ entries, total }, activeLetters, resolvedLinks] = await Promise.all([
		listLanguageEntries(lang.id, letter || null, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
		listActiveLetters(lang.id),
		getResolvedLinks({ kind: 'language', entityId: lang.id }),
	])

	// The language's wiki body renders on this page (prose + {{Consonants}} /
	// {{Vowels}} / {{Orthography}} grids). Cached AST when available.
	const body = (lang.body ?? '').trim()
	const bodyAst: WikiNode | null = body
		? ((lang.bodyParsedAst as WikiNode) ?? parseWikitext(body))
		: null

	let structuredCollections: Record<string, Record<string, unknown>[]> | null = null
	if (bodyAst) {
		const collectionRefs = extractCollectionRefs(bodyAst)
		if (collectionRefs.length > 0) {
			const resolved = await resolveAllStructuredCollections(collectionRefs)
			if (resolved.size > 0) structuredCollections = Object.fromEntries(resolved)
		}
	}

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
		resolvedLinks: serializeResolvedLinks(resolvedLinks),
		bodyAst,
		structuredCollections,
	}
}
