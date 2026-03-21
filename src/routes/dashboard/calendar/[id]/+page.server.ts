import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { redirect, error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/auth/login')
	if (locals.user.role !== 'admin') error(403, 'Admin access required')

	const id = Number.parseInt(params.id)
	if (isNaN(id)) error(400, 'Invalid ID')

	const [cal] = await db.select().from(calendars).where(eq(calendars.id, id))
	if (!cal) error(404, 'Calendar not found')

	return { calendar: cal }
}
