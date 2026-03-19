import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { AuthUser } from './auth.js';

/** Require at least editor role — redirects to login for page loads */
export function requireEditor(event: RequestEvent): AuthUser {
	const user = event.locals.user;
	if (!user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`);
	}
	return user;
}

/** Require admin role — redirects to login or 403s */
export function requireAdmin(event: RequestEvent): AuthUser {
	const user = event.locals.user;
	if (!user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`);
	}
	if (user.role !== 'admin') {
		throw redirect(302, '/dashboard?error=forbidden');
	}
	return user;
}
