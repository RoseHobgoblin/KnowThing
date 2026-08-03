import { error, type RequestEvent } from '@sveltejs/kit'
import { roles } from './auth-permissions.js'

export const ROLE_HIERARCHY = ['viewer', 'editor', 'admin', 'owner'] as const
export type Role = (typeof ROLE_HIERARCHY)[number]

export interface AuthUser {
	id: number
	username: string
	role: Role
}

/** Convert Better Auth's string-normalized database output to the app's legacy user shape. */
export function toAuthUser(user: {
	id: string
	name: string
	username?: string | null
	displayUsername?: string | null
	role?: string | null
}): AuthUser | null {
	const id = Number.parseInt(user.id, 10)
	if (!Number.isSafeInteger(id)) return null

	const role = ROLE_HIERARCHY.includes(user.role as Role) ? user.role as Role : 'viewer'
	return {
		id,
		username: user.displayUsername ?? user.username ?? user.name,
		role,
	}
}

/** Check whether a role is at least the requested level in KnowThing's hierarchy. */
export function hasRole(userRole: string, minimumRole: Role): boolean {
	const userLevel = ROLE_HIERARCHY.indexOf(userRole as Role)
	const requiredLevel = ROLE_HIERARCHY.indexOf(minimumRole)
	return userLevel >= requiredLevel
}

export function hasPermission(
	userRole: string,
	permission: { resource: 'content' | 'settings' | 'users', action: string },
): boolean {
	const role = roles[userRole as Role]
	if (!role) return false
	return role.authorize({ [permission.resource]: [permission.action] }).success
}

export function requireAuth(event: RequestEvent): AuthUser {
	const user = event.locals.user
	if (!user) throw error(401, 'Authentication required')
	return user
}

export function requireRole(event: RequestEvent, minimumRole: Role): AuthUser {
	const user = requireAuth(event)
	if (!hasRole(user.role, minimumRole)) throw error(403, 'Insufficient permissions')
	return user
}
