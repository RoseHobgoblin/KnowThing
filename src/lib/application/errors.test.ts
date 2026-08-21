import { describe, expect, it } from 'vitest'
import { ApplicationError, conflictError, isApplicationError, missingError, validationError } from './errors.js'

describe('ApplicationError', () => {
	it('preserves stable failure metadata', () => {
		const failure = validationError('invalid_name', 'Name is invalid', { field: 'name' })
		expect(failure).toMatchObject({
			kind: 'validation',
			code: 'invalid_name',
			message: 'Name is invalid',
			details: { field: 'name' },
		})
		expect(isApplicationError(failure)).toBe(true)
	})

	it('constructs missing and conflict failures', () => {
		expect(missingError('missing_page', 'Page not found').kind).toBe('missing')
		expect(conflictError('duplicate_page', 'Page exists').kind).toBe('conflict')
		expect(isApplicationError(new Error('no'))).toBe(false)
		expect(new ApplicationError('unexpected', 'failure', 'Hidden').kind).toBe('unexpected')
	})
})
