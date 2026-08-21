import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { uploadMediaFile } from '$lib/feature/media/public/server/media.server.js'
import { listMedia } from '$lib/feature/media/public/server/search.server.js'
import { parseUnifiedSearchParams } from '$lib/feature/search/public/server/query.server.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** GET /api/media — list media with search, filter, pagination */
export const GET: RequestHandler = async ({ url }) => {
	const params = parseUnifiedSearchParams(url, { scope: 'media', limit: 50, offset: 0 })
	const result = await listMedia({
		q: params.q,
		category: params.filters.mediaCategory,
		sort: params.filters.sort ?? 'newest',
		unused: params.filters.unused,
		imageOnly: url.searchParams.get('kind') === 'image',
		aspectRatio: Number(url.searchParams.get('aspectRatio')) || undefined,
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

	return handleServiceCall(async () => {
		return json(await uploadMediaFile(user.id, file), { status: 201 })
	})
}
