import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateCalendarSchema } from '$lib/server/http/calendar/schemas.js'
import { deleteCalendar, getCalendarById, updateCalendar } from '$lib/server/services/calendar.js'

function parseId(raw: string) {
	const id = Number.parseInt(raw)
	if (isNaN(id)) return null
	return id
}

/** GET /api/calendar/:id */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await getCalendarById(id)))
}

/** PUT /api/calendar/:id — update calendar config */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	const data = await parseBody(event.request, updateCalendarSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateCalendar(id, data)))
}

/** DELETE /api/calendar/:id */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const id = parseId(event.params.id)
	if (id == null) return json({ error: 'Invalid ID' }, { status: 400 })

	return handleServiceCall(async () => json(await deleteCalendar(id)))
}
