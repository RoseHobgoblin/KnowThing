import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { asc } from 'drizzle-orm'
import { redirect, error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/auth/login')
	if (locals.user.role !== 'admin') error(403, 'Admin access required')

	const allUsers = await db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(asc(users.username))

	return { users: allUsers }
}
