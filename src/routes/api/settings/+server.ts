import { json, type RequestHandler } from '@sveltejs/kit'
import { z } from 'zod'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { getSiteSettings, updateSiteSettings } from '$lib/server/services/settings.js'

const updateSchema = z.record(z.string(), z.string())

/** GET /api/settings — get all settings */
export const GET: RequestHandler = async () => {
	return handleServiceCall(async () => json(await getSiteSettings()))
}

/** PUT /api/settings — update settings (admin only) */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const data = await parseBody(event.request, updateSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateSiteSettings(data)))
}
