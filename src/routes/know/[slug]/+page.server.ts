import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { parseWikitext, extractCategoriesFromAst, extractInfoboxFromRefs, extractRodderDisplayRefs, extractCollectionRefs, extractSummaryFromAst } from '$lib/parser/index.js'
import { resolveAllStructuredData, resolveAllStructuredCollections } from '$lib/server/structured-data.js'
import { resolveRodderEntityDocuments, resolveRodderSectorDocuments } from '$lib/feature/rodder/server/documents.server.js'
import { getResolvedLinks, serializeResolvedLinks } from '$lib/server/resolved-links.js'
import { lookupMediaInfo, resolveCardImageSync } from '$lib/server/services/page-card.js'
import { findPageCaseInsensitive, findPageInAnyDomain } from '$lib/server/services/pages.js'
import { buildHref } from '$lib/server/resolved-links.js'
import { findLanguageMatchByPageSlug, findWordbookMatchByTitle } from '$lib/feature/wordbook/server/service.server.js'

export const load: PageServerLoad = async ({ params }) => {
	const record = await findPageCaseInsensitive('know', params.slug)

	// Canonical redirect: if slug casing doesn't match stored form
	if (record && record.slug !== params.slug) {
		redirect(301, `/know/${record.slug}`)
	}

	if (!record) {
		// Check if this slug exists in another domain (e.g. moved to rodder)
		const otherDomain = await findPageInAnyDomain(params.slug)

		if (otherDomain) {
			// For wordbook lexicon entries, the resolver returns
			// { domain: 'wordbook', slug: <word>, parentPath: <langSlug> } — the
			// shared buildHref expects target_slug already in `<lang>/<word>`
			// shape, so combine here.
			const slugForBuild = otherDomain.domain === 'wordbook' && otherDomain.parentPath
				? `${otherDomain.parentPath}/${otherDomain.slug}`
				: otherDomain.slug
			redirect(301, buildHref(otherDomain.domain, slugForBuild, otherDomain.domain === 'wordbook' ? null : otherDomain.parentPath))
		}

		const normalizedSlug = params.slug[0].toUpperCase() + params.slug.slice(1)
		return {
			notFound: true,
			slug: normalizedSlug,
			title: normalizedSlug.replaceAll('_', ' '),
			ast: null,
			categories: [],
			description: '',
			card: { image: null, mimeType: null, hasRaster: false },
		}
	}

	// Use cached AST if available, otherwise parse fresh
	const ast = (record.parsedAst as import('$lib/parser/types.js').WikiNode) ?? parseWikitext(record.content)
	const cats = extractCategoriesFromAst(ast)

	const resolvedLinks = await getResolvedLinks(record.id)

	const fromRefs = extractInfoboxFromRefs(ast)
	let structuredData: Record<string, Record<string, string>> | null = null
	if (fromRefs.length > 0) {
		const resolved = await resolveAllStructuredData(fromRefs)
		if (resolved.size > 0) {
			structuredData = {}
			for (const [slug, fieldMap] of resolved) {
				structuredData[slug] = Object.fromEntries(fieldMap)
			}
		}
	}

	const displayReferences = [...new Map(extractRodderDisplayRefs(ast).map(reference => [
		`${reference.kind}:${reference.slug.toLowerCase()}`,
		reference,
	])).values()]
	const selectedDisplays = displayReferences.slice(0, 24)
	const rootMapSlugs = selectedDisplays.filter(reference => reference.kind === 'root').map(reference => reference.slug)
	const sectorMapSlugs = selectedDisplays.filter(reference => reference.kind === 'sector').map(reference => reference.slug)
	const [rodderEntities, rodderSectors] = await Promise.all([
		rootMapSlugs.length > 0 ? resolveRodderEntityDocuments(rootMapSlugs) : Promise.resolve({}),
		sectorMapSlugs.length > 0 ? resolveRodderSectorDocuments(sectorMapSlugs) : Promise.resolve({}),
	])

	const collectionRefs = extractCollectionRefs(ast)
	let structuredCollections: Record<string, Record<string, unknown>[]> | null = null
	if (collectionRefs.length > 0) {
		const resolved = await resolveAllStructuredCollections(collectionRefs)
		if (resolved.size > 0) {
			structuredCollections = Object.fromEntries(resolved)
		}
	}

	const wordbookMatch = await findWordbookMatchByTitle(record.title)
	const languageMatch = await findLanguageMatchByPageSlug(record.slug)

	const description = extractSummaryFromAst(ast, { maxLength: 200 })
	const cardImage = resolveCardImageSync(ast, structuredData)
	const cardMedia = cardImage ? await lookupMediaInfo(cardImage) : null

	return {
		notFound: false,
		slug: record.slug,
		title: record.title,
		content: record.content,
		contentRecordId: record.id,
		ast,
		categories: cats,
		updatedAt: record.updatedAt,
		wordbookMatch,
		languageMatch,
		structuredData,
		structuredCollections,
		rodderEntities,
		rodderSectors,
		rodderDisplayOverflow: Math.max(0, displayReferences.length - selectedDisplays.length),
		resolvedLinks: serializeResolvedLinks(resolvedLinks),
		description,
		card: {
			image: cardImage,
			mimeType: cardMedia?.mimeType ?? null,
			hasRaster: cardMedia?.hasRaster ?? false,
		},
	}
}
