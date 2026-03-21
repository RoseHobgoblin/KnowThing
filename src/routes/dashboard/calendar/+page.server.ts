import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import { asc } from 'drizzle-orm'
import { redirect, error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/auth/login')
	if (locals.user.role !== 'admin') error(403, 'Admin access required')

	const all = await db
		.select({
			id: calendars.id,
			name: calendars.name,
			description: calendars.description,
			isPrimary: calendars.isPrimary,
		})
		.from(calendars)
		.orderBy(asc(calendars.name))

	return { calendars: all }
}
