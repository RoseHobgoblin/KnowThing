import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'

/** GET /api/calendar — get primary calendar info */
export const GET: RequestHandler = async () => {
	const [cal] = await db
		.select()
		.from(calendars)
		.where(eq(calendars.isPrimary, true))
		.limit(1)

	if (!cal) {
		return json({ error: 'No primary calendar configured' }, { status: 404 })
	}

	return json(cal)
}
