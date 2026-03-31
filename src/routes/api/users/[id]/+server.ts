import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { deleteManagedUser } from '$lib/server/services/user-admin.js'

/** DELETE /api/users/:id — delete a user (admin only, cannot delete owner or self) */
export const DELETE: RequestHandler = async (event) => {
	const admin = requireRole(event, 'admin')

	const id = Number.parseInt(event.params.id)
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 })

	try {
		await deleteManagedUser(admin, id)
		return json({ success: true })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
