import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
	content: ['read', 'create', 'update', 'delete'],
	settings: ['read', 'update'],
	users: ['read', 'manage'],
} as const

export const accessControl = createAccessControl(statement)

export const roles = {
	viewer: accessControl.newRole({
		content: ['read'],
		settings: ['read'],
		users: [],
	}),
	editor: accessControl.newRole({
		content: ['read', 'create', 'update', 'delete'],
		settings: ['read'],
		users: [],
	}),
	admin: accessControl.newRole({
		content: ['read', 'create', 'update', 'delete'],
		settings: ['read', 'update'],
		users: ['read', 'manage'],
	}),
	owner: accessControl.newRole({
		content: ['read', 'create', 'update', 'delete'],
		settings: ['read', 'update'],
		users: ['read', 'manage'],
	}),
} as const
