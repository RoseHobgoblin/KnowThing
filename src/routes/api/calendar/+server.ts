import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createCalendarSchema } from '$lib/feature/calendar/public/server/schemas.server.js'
import { createCalendar, getPrimaryCalendar } from '$lib/feature/calendar/public/server/calendars.server.js'

/** GET /api/calendar — get primary calendar */
export const GET: RequestHandler = async () => {
	return handleServiceCall(async () => json(await getPrimaryCalendar()))
}

/** POST /api/calendar — create a calendar */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createCalendarSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createCalendar(data), { status: 201 }))
}
