import { describe, expect, it } from 'vitest'
import { hasPermission, hasRole, toAuthUser } from './auth.js'

describe('auth compatibility guards', () => {
	it('normalizes a Better Auth user for existing application services', () => {
		expect(toAuthUser({
			id: '42',
			name: 'normalized',
			username: 'normalized',
			displayUsername: 'Displayed Name',
			role: 'admin',
		})).toEqual({ id: 42, username: 'Displayed Name', role: 'admin' })
	})

	it('rejects non-numeric ids and downgrades unknown roles', () => {
		expect(toAuthUser({ id: 'not-an-id', name: 'bad' })).toBeNull()
		expect(toAuthUser({ id: '1', name: 'safe', role: 'unexpected' })?.role).toBe('viewer')
	})

	it('preserves the role hierarchy and permission boundaries', () => {
		expect(hasRole('owner', 'admin')).toBe(true)
		expect(hasRole('editor', 'admin')).toBe(false)
		expect(hasPermission('editor', { resource: 'content', action: 'delete' })).toBe(true)
		expect(hasPermission('editor', { resource: 'users', action: 'manage' })).toBe(false)
	})
})
