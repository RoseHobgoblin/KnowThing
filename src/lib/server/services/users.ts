import { asc, desc } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { registrationCodes, users } from '$lib/server/db/schema.js'

export async function listUsers() {
	return db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(asc(users.username))
}

export async function listRecentRegistrationCodes(limit = 20) {
	return db
		.select()
		.from(registrationCodes)
		.orderBy(desc(registrationCodes.createdAt))
		.limit(limit)
}
