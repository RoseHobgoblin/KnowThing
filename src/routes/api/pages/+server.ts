import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createKnowPage } from '$lib/server/services/content.js'
import { listPages } from '$lib/server/services/pages.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createPageSchema } from '$lib/server/http/pages/schemas.js'

/** GET /api/pages — list all pages */
export const GET: RequestHandler = async () => {
	return json(await listPages())
}

/** POST /api/pages — create a new page */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const data = await parseBody(event.request, createPageSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const record = await createKnowPage({
			title: data.title,
			content: data.content || '',
			slug: data.slug,
			userId: user.id,
		})
		return json(record, { status: 201 })
	})
}
