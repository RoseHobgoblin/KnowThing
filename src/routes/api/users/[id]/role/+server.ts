import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** PUT /api/users/:id/role — change a user's role (admin only) */
export const PUT: RequestHandler = async (event) => {
	const admin = requireAuth(event)
	if (admin.role !== 'admin') {
		return json({ error: 'Admin access required' }, { status: 403 })
	}

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { role } = body as { role: string }

	if (!['editor', 'admin'].includes(role)) {
		return json({ error: 'Role must be "editor" or "admin"' }, { status: 400 })
	}

	// Prevent demoting yourself
	if (id === admin.id && role !== 'admin') {
		return json({ error: 'Cannot demote yourself' }, { status: 400 })
	}

	const [updated] = await db
		.update(users)
		.set({ role })
		.where(eq(users.id, id))
		.returning()

	if (!updated) return json({ error: 'User not found' }, { status: 404 })
	return json({ success: true, role: updated.role })
}
