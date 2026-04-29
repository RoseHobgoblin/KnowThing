import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { updateKnowPage } from '$lib/server/services/content.js'
import { deletePage, getPage } from '$lib/server/services/pages.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updatePageSchema } from '$lib/server/http/pages/schemas.js'

/** GET /api/pages/:slug?domain=know */
export const GET: RequestHandler = async ({ params, url }) => {
	const domain = url.searchParams.get('domain') || 'know'
	return handleServiceCall(async () => json(await getPage(domain, params.slug)))
}

/** PUT /api/pages/:slug — update page */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const data = await parseBody(event.request, updatePageSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const updated = await updateKnowPage({
			slug: event.params.slug,
			title: data.title,
			content: data.content,
			editSummary: data.editSummary,
			userId: user.id,
		})
		return json(updated)
	})
}

/** DELETE /api/pages/:slug?domain=know */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'editor')
	const domain = event.url.searchParams.get('domain') || 'know'
	return handleServiceCall(async () => json(await deletePage(domain, event.params.slug)))
}
