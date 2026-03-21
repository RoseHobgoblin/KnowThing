import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { asc } from 'drizzle-orm'

/** GET /api/calendar/all — list all calendars */
export const GET: RequestHandler = async () => {
	const all = await db
		.select({
			id: calendars.id,
			name: calendars.name,
			description: calendars.description,
			isPrimary: calendars.isPrimary,
		})
		.from(calendars)
		.orderBy(asc(calendars.name))

	return json(all)
}
