import { redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { type AuthUser, hasRole } from './auth.js'

function requirePageUser(event: RequestEvent): AuthUser {
	const user = event.locals.user
	if (!user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`)
	}
	return user
}

function requirePageRole(event: RequestEvent, minimumRole: 'editor' | 'admin' | 'owner'): AuthUser {
	const user = requirePageUser(event)
	const allowed = minimumRole === 'owner'
		? user.role === 'owner'
		: hasRole(user.role, minimumRole)

	if (!allowed) {
		throw redirect(302, '/')
	}

	return user
}

export function requireEditor(event: RequestEvent): AuthUser {
	return requirePageRole(event, 'editor')
}

export function requireAdmin(event: RequestEvent): AuthUser {
	return requirePageRole(event, 'admin')
}

export function requireOwner(event: RequestEvent): AuthUser {
	return requirePageRole(event, 'owner')
}
