import { json, type RequestHandler } from '@sveltejs/kit'
import { getPageCard, buildCardImageUrl } from '$lib/server/services/page-card.js'

/**
 * GET /api/pages/summary?slug=onchera&domain=know
 * Returns card metadata for link previews — same source as OG/Twitter tags.
 */
export const GET: RequestHandler = async ({ url }) => {
	const slug = url.searchParams.get('slug')
	if (!slug) return json({ error: 'Missing slug' }, { status: 400 })

	const domain = url.searchParams.get('domain') || 'know'
	const card = await getPageCard(slug, domain)
	if (!card) return json({ error: 'Not found' }, { status: 404 })

	return json({
		title: card.title,
		summary: card.description,
		image: buildCardImageUrl(url.origin, card),
		imageWidth: card.imageWidth,
		imageHeight: card.imageHeight,
	})
}
