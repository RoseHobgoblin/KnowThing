import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { moveKnowPage } from '$lib/server/services/content.js'
import { loadPageForMove } from '$lib/server/services/pages.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { movePageSchema } from '$lib/server/http/pages/schemas.js'

/** POST /api/pages/:slug/move — rename/move page */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const data = await parseBody(event.request, movePageSchema)
	if (data instanceof Response) return data

	const domain = event.url.searchParams.get('domain') || 'know'

	return handleServiceCall(async () => {
		const existing = await loadPageForMove(domain, event.params.slug)
		const updated = await moveKnowPage({
			slug: event.params.slug,
			newSlug: data.newSlug.trim(),
			newTitle: data.newTitle?.trim() || existing.title,
			userId: user.id,
		})
		return json({ slug: updated.slug, title: updated.title })
	})
}
