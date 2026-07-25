import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { parseWikitext, extractCategoriesFromAst, extractInfoboxFromRefs, extractSystemMapRefs, extractCollectionRefs, extractSummaryFromAst } from '$lib/parser/index.js'
import { resolveAllStructuredData, resolveAllStructuredCollections, resolveAllSystemMaps } from '$lib/server/structured-data.js'
import { getResolvedLinks, serializeResolvedLinks } from '$lib/server/resolved-links.js'
import { lookupMediaInfo, resolveCardImageSync } from '$lib/server/services/page-card.js'
import { findPageCaseInsensitive, findPageInAnyDomain } from '$lib/server/services/pages.js'
import { buildHref } from '$lib/server/resolved-links.js'
import { findLanguageMatchByPageSlug, findWordbookMatchByTitle } from '$lib/server/services/wordbook.js'
import { resolveKnowPageRead } from '$lib/server/services/entity-resolver.js'

export const load: PageServerLoad = async ({ params }) => {
	// Reader flip: resolve through entity routes first. Canonical → render,
	// retired addresses → 301, archived → render with a banner. Unrouted
	// slugs fall through to the legacy lookup below.
	const routed = await resolveKnowPageRead(params.slug)
	if (routed?.kind === 'redirect') {
		redirect(301, routed.href)
	}
	const archived = routed?.kind === 'article' && routed.archived

	const record = routed?.kind === 'article'
		? routed.record
		: await findPageCaseInsensitive('know', params.slug)

	// Canonical redirect for unrouted records: if slug casing doesn't match
	// the stored form (routed reads already canonicalized above).
	if (!routed && record && record.slug !== params.slug) {
		redirect(301, `/know/${record.slug}`)
	}

	if (!record) {
		// Check if this slug exists in another domain (e.g. moved to celestial)
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
			archived: false,
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

	const systemMapSlugs = extractSystemMapRefs(ast)
	const systemMaps = systemMapSlugs.length > 0
		? await resolveAllSystemMaps(systemMapSlugs)
		: null

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
		archived,
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
		systemMaps,
		resolvedLinks: serializeResolvedLinks(resolvedLinks),
		description,
		card: {
			image: cardImage,
			mimeType: cardMedia?.mimeType ?? null,
			hasRaster: cardMedia?.hasRaster ?? false,
		},
	}
}
