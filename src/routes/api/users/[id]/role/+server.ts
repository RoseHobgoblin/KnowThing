import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { changeManagedUserRole } from '$lib/server/services/user-admin.js'
import { handleServiceCall } from '$lib/server/utils.js'

/** PUT /api/users/:id/role — change a user's role */
export const PUT: RequestHandler = async (event) => {
	const admin = requireRole(event, 'admin')

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	const body = await event.request.json()
	const { role } = body as { role: string }

	return handleServiceCall(async () => {
		const updated = await changeManagedUserRole(admin, id, role)
		return json({ success: true, role: updated.role })
	})
}
