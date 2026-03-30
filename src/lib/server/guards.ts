import { redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { type AuthUser, hasRole } from './auth.js'

/** Require at least editor role — redirects to login for page loads */
export function requireEditor(event: RequestEvent): AuthUser {
	const user = event.locals.user
	if (!user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`)
	}
	if (!hasRole(user.role, 'editor')) {
		throw redirect(302, '/')
	}
	return user
}

/** Require at least admin role — redirects to login or home */
export function requireAdmin(event: RequestEvent): AuthUser {
	const user = event.locals.user
	if (!user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`)
	}
	if (!hasRole(user.role, 'admin')) {
		throw redirect(302, '/')
	}
	return user
}
