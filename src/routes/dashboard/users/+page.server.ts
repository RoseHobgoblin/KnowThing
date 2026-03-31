import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users, registrationCodes } from '$lib/server/db/schema.js'
import { asc, desc } from 'drizzle-orm'
import { requireAdmin } from '$lib/server/guards.js'

function maskRegistrationCode(code: string): string {
	if (code.length <= 4) return '•'.repeat(code.length)
	if (code.length <= 8) return `${code.slice(0, 2)}••••${code.slice(-2)}`
	return `${code.slice(0, 4)}••••${code.slice(-4)}`
}

export const load: PageServerLoad = async (event) => {
	const currentUser = requireAdmin(event)

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

	return {
		users: allUsers,
		codes: codes.map((code) => ({
			...code,
			code: maskRegistrationCode(code.code),
			isMasked: true,
			isOwnerOnlyRole: code.role === 'admin' && currentUser.role !== 'owner',
		})),
	}
}
