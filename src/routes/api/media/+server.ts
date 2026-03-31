import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { uploadMediaFile } from '$lib/server/services/media.js'
import { listMedia } from '$lib/server/services/search/media.js'
import { parseUnifiedSearchParams } from '$lib/server/services/search/query.js'

/** GET /api/media — list media with search, filter, pagination */
export const GET: RequestHandler = async ({ url }) => {
	const params = parseUnifiedSearchParams(url, { scope: 'media', limit: 50, offset: 0 })
	const result = await listMedia({
		q: params.q,
		category: params.filters.mediaCategory,
		sort: params.filters.sort ?? 'newest',
		unused: params.filters.unused,
		limit: Math.min(params.limit, 200),
		offset: params.offset,
	})

	return json(result)
}

/** POST /api/media — upload file with processing */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const formData = await event.request.formData()
	const file = formData.get('file')

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 })
	}

	try {
		return json(await uploadMediaFile(user.id, file), { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? 'Request failed' }, { status: err.status })
		}
		throw err
	}
}
