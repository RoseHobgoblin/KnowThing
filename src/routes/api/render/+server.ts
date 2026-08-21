import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { extractDomainLinksFromAst, extractLinksFromAst, extractRodderDisplayRefs, parseWikitext } from '$lib/parser/index.js'
import { resolveLinkTargets, serializeResolvedLinks } from '$lib/server/resolved-links.js'
import { wikiSlugify } from '$lib/utils/slugify.js'
import { parseBody } from '$lib/server/utils.js'
import { resolveRodderEntityDocuments, resolveRodderSectorDocuments } from '$lib/feature/rodder/public/server/documents.server.js'
import { RODDER_CALENDAR_PORT } from '$lib/composition/rodder-calendar-port.server.js'

const renderSchema = z.object({
	// The only parser entry point open to anonymous callers, so it needs its own
	// ceiling: BODY_SIZE_LIMIT is process-wide and was raised to 15MB for media
	// uploads, which would otherwise apply here too.
	content: z.string().max(200_000),
	// Domain the wikitext is being edited in — same-domain links resolve here first.
	domain: z.string().max(32).default('know'),
})

// Ceiling on how many distinct link targets one preview will resolve. A normal
// article is far under this; the cap keeps a hostile 200KB body of nothing but
// wikilinks from turning one anonymous request into an unbounded lookup.
const MAX_PREVIEW_LINK_TARGETS = 500

/** POST /api/render — parse wikitext, return AST JSON + link map (for live preview) */
export const POST: RequestHandler = async ({ request }) => {
	const data = await parseBody(request, renderSchema)
	if (data instanceof Response) return data

	const ast = parseWikitext(data.content)

	// Mirror how `updateContentEffects` records links on save — same-domain
	// targets slugified, cross-domain identifiers verbatim — so a link that
	// renders live in the preview still renders live once saved.
	const targets = [
		...extractLinksFromAst(ast).map(target => ({ domain: data.domain, slug: wikiSlugify(target) })),
		...extractDomainLinksFromAst(ast).map(({ domain, target }) => ({ domain, slug: target })),
	].slice(0, MAX_PREVIEW_LINK_TARGETS)

	const resolvedLinks = await resolveLinkTargets(targets)
	const displayReferences = [...new Map(extractRodderDisplayRefs(ast).map(reference => [
		`${reference.kind}:${reference.slug.toLowerCase()}`,
		reference,
	])).values()]
	const selectedDisplays = displayReferences.slice(0, 24)
	const rootSlugs = selectedDisplays.filter(reference => reference.kind === 'root').map(reference => reference.slug)
	const sectorSlugs = selectedDisplays.filter(reference => reference.kind === 'sector').map(reference => reference.slug)
	const [rodderEntities, rodderSectors] = await Promise.all([
		resolveRodderEntityDocuments(rootSlugs, RODDER_CALENDAR_PORT),
		resolveRodderSectorDocuments(sectorSlugs),
	])

	return json({
		ast,
		resolvedLinks: serializeResolvedLinks(resolvedLinks),
		rodderEntities,
		rodderSectors,
		rodderDisplayOverflow: Math.max(0, displayReferences.length - selectedDisplays.length),
	})
}
