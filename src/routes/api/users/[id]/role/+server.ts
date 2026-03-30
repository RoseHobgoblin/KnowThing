import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { requireRole, hasRole, type Role, ROLE_HIERARCHY } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** PUT /api/users/:id/role — change a user's role */
export const PUT: RequestHandler = async (event) => {
	const admin = requireRole(event, 'admin')

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { role } = body as { role: string }

	if (!ROLE_HIERARCHY.includes(role as Role)) {
		return json({ error: `Role must be one of: ${ROLE_HIERARCHY.join(', ')}` }, { status: 400 })
	}

	// Can't set owner role
	if (role === 'owner') {
		return json({ error: 'Cannot assign owner role' }, { status: 400 })
	}

	// Only owner can grant admin
	if (role === 'admin' && admin.role !== 'owner') {
		return json({ error: 'Only the owner can grant admin role' }, { status: 403 })
	}

	// Can't demote yourself
	if (id === admin.id) {
		return json({ error: 'Cannot change your own role' }, { status: 400 })
	}

	// Can't modify the owner
	const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id))
	if (!target) return json({ error: 'User not found' }, { status: 404 })
	if (target.role === 'owner') {
		return json({ error: 'Cannot modify the owner' }, { status: 400 })
	}

	const [updated] = await db
		.update(users)
		.set({ role })
		.where(eq(users.id, id))
		.returning()

	return json({ success: true, role: updated.role })
}
