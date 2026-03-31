import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users, registrationCodes } from '$lib/server/db/schema.js'
import { asc, desc } from 'drizzle-orm'
import { requireAdmin } from '$lib/server/guards.js'

export const load: PageServerLoad = async (event) => {
	requireAdmin(event)

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
