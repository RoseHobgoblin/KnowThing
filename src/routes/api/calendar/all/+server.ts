import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { listCalendars } from '$lib/server/services/calendar.js'

/** GET /api/calendar/all — list all calendars */
export const GET: RequestHandler = async () => {
	return json(await listCalendars())
}
