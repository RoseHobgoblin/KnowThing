import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { ROLE_HIERARCHY, type Role } from '$lib/server/auth.js'

export async function deleteManagedUser(admin: { id: number, role: string }, targetUserId: number): Promise<void> {
	if (targetUserId === admin.id) {
		throw error(400, 'Cannot delete yourself')
	}

	const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetUserId))
	if (!target) throw error(404, 'User not found')
	if (target.role === 'owner') {
		throw error(400, 'Cannot delete the owner')
	}

	await db.delete(users).where(eq(users.id, targetUserId))
}

export async function changeManagedUserRole(
	admin: { id: number, role: string },
	targetUserId: number,
	role: string,
): Promise<{ role: string }> {
	if (!ROLE_HIERARCHY.includes(role as Role)) {
		throw error(400, `Role must be one of: ${ROLE_HIERARCHY.join(', ')}`)
	}

	if (role === 'owner') {
		throw error(400, 'Cannot assign owner role')
	}

	if (role === 'admin' && admin.role !== 'owner') {
		throw error(403, 'Only the owner can grant admin role')
	}

	if (targetUserId === admin.id) {
		throw error(400, 'Cannot change your own role')
	}

	const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetUserId))
	if (!target) throw error(404, 'User not found')
	if (target.role === 'owner') {
		throw error(400, 'Cannot modify the owner')
	}

	const [updated] = await db
		.update(users)
		.set({ role, updatedAt: new Date() })
		.where(eq(users.id, targetUserId))
		.returning({ role: users.role })

	return updated
}
