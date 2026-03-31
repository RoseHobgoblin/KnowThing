import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users, registrationCodes } from '$lib/server/db/schema.js'
import { asc, desc } from 'drizzle-orm'
import { redirect, error } from '@sveltejs/kit'
import { hasRole } from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login')
	if (!hasRole(locals.user.role, 'admin')) throw error(403, 'Admin access required')

	const allUsers = await db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(asc(users.username))

	const codes = await db
		.select()
		.from(registrationCodes)
		.orderBy(desc(registrationCodes.createdAt))
		.limit(20)

	return { users: allUsers, codes }
}
