import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { requireRole, deleteUser } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** DELETE /api/users/:id — delete a user (admin only, cannot delete owner or self) */
export const DELETE: RequestHandler = async (event) => {
	const admin = requireRole(event, 'admin')

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	if (id === admin.id) {
		return json({ error: 'Cannot delete yourself' }, { status: 400 })
	}

	const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id))
	if (!target) return json({ error: 'User not found' }, { status: 404 })
	if (target.role === 'owner') {
		return json({ error: 'Cannot delete the owner' }, { status: 400 })
	}

	await deleteUser(id)
	return json({ success: true })
}
