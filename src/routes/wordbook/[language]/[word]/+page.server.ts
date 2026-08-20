import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/feature/wordbook/server/etymology.server.js'
import { getInflectionTable } from '$lib/feature/wordbook/server/inflection.server.js'
import {
	getLanguageBySlug,
	listDefinitionsForEntries,
	listHomographs,
	listVariantsForEntries,
} from '$lib/feature/wordbook/server/service.server.js'
import { listClassesForLanguage } from '$lib/feature/wordbook/server/inflections.server.js'
import { getResolvedLinks, serializeResolvedLinks } from '$lib/server/resolved-links.js'
import { extractCollectionRefs, parseWikitext } from '$lib/parser/index.js'
import { resolveAllStructuredCollections } from '$lib/server/structured-data.js'
import type { WikiNode } from '$lib/parser/types.js'

function groupBy<T>(items: T[], keyFn: (item: T) => number): Map<number, T[]> {
	const map = new Map<number, T[]>()
	for (const item of items) {
		const key = keyFn(item)
		if (!map.has(key)) map.set(key, [])
		map.get(key)!.push(item)
	}
	return map
}

export const load: PageServerLoad = async ({ params }) => {
	const word = decodeURIComponent(params.word).normalize('NFC')

	const lang = await getLanguageBySlug(params.language)
	if (!lang) error(404, 'Language not found')

	const entries = await listHomographs(lang.id, word)
	if (entries.length === 0) error(404, `No entry for "${word}" in ${lang.name}`)

	const storedWord = entries[0].word
	if (decodeURIComponent(params.word) !== storedWord) {
		redirect(301, `/Wordbook/${params.language}/${encodeURIComponent(storedWord)}`)
	}

	const entryIds = entries.map(e => e.id)

	const [allDefs, allVariants, allInflections, ...etymologyResults] = await Promise.all([
		listDefinitionsForEntries(entryIds),
		listVariantsForEntries(entryIds),
		Promise.all(entryIds.map(id => getInflectionTable(id))),
		...entryIds.map(id => Promise.all([
			getDirectRelations(id),
			computeCognates(id, lang.id),
			getEtymologyChain(id),
		])),
	])

	const defsByEntry = groupBy(allDefs, d => d.entryId)
	const variantsByEntry = groupBy(allVariants, v => v.entryId)

	const homographs = entries.map((entry, index) => {
		// Entry wiki bodies render on this page; cached AST when available.
		const body = (entry.body ?? '').trim()
		const bodyAst: WikiNode | null = body
			? ((entry.bodyParsedAst as WikiNode) ?? parseWikitext(body))
			: null
		return {
			entry,
			bodyAst,
			definitions: defsByEntry.get(entry.id) || [],
			variants: variantsByEntry.get(entry.id) || [],
			inflection: allInflections[index],
			relations: {
				direct: etymologyResults[index][0],
				cognates: etymologyResults[index][1],
				etymologyChain: etymologyResults[index][2],
			},
		}
	})

	const availableClasses = await listClassesForLanguage(lang.id)

	// Resolved links for whichever entry has a body. If multiple homographs have
	// bodies (rare), we just merge their link maps — they share a wordbook
	// namespace anyway.
	const linkMaps = await Promise.all(
		homographs
			.filter(h => h.entry.body && h.entry.body.length > 0)
			.map(h => getResolvedLinks({ kind: 'lexicon', entityId: h.entry.id })),
	)
	const resolvedLinks: Record<string, { href: string, exists: boolean }> = {}
	for (const m of linkMaps) Object.assign(resolvedLinks, serializeResolvedLinks(m))

	// Structured collections referenced by any homograph body (rare but legal).
	const collectionRefs = homographs.flatMap(h => (h.bodyAst ? extractCollectionRefs(h.bodyAst) : []))
	let structuredCollections: Record<string, Record<string, unknown>[]> | null = null
	if (collectionRefs.length > 0) {
		const resolved = await resolveAllStructuredCollections(collectionRefs)
		if (resolved.size > 0) structuredCollections = Object.fromEntries(resolved)
	}

	return {
		word: entries[0].word,
		language: lang,
		homographs,
		isMultipleHomographs: entries.length > 1,
		availableClasses,
		resolvedLinks,
		structuredCollections,
	}
}
