import { describe, expect, it } from 'vitest'
import { normalizeApiErrorResponse } from './json-endpoint.js'
import { jsonEndpoint } from './json-endpoint.js'
import { ApplicationError, type ApplicationErrorKind } from '$lib/application/errors.js'

describe('API response normalization', () => {
	it('preserves successful responses by identity', async () => {
		const response = Response.json({ value: 42 })
		expect(await normalizeApiErrorResponse(response)).toBe(response)
	})

	it('normalizes legacy JSON failures', async () => {
		const response = Response.json({ error: 'Bad input', issues: ['name required'] }, { status: 400 })
		const normalized = await normalizeApiErrorResponse(response)
		expect(await normalized.json()).toEqual({
			error: { code: 'invalid_request', message: 'Bad input', details: ['name required'] },
		})
	})

	it('redacts unknown server failures', async () => {
		const response = Response.json({ stack: 'secret' }, { status: 500 })
		const normalized = await normalizeApiErrorResponse(response)
		expect(await normalized.json()).toEqual({ error: { code: 'internal_error', message: 'An unexpected error occurred' } })
	})

	it('does not touch binary failures', async () => {
		const response = new Response(new Uint8Array([1, 2]), { status: 404, headers: { 'content-type': 'application/octet-stream' } })
		expect(await normalizeApiErrorResponse(response)).toBe(response)
	})
})

describe('application error HTTP mapping', () => {
	it.each([
		['validation', 400], ['unauthenticated', 401], ['forbidden', 403], ['missing', 404],
		['conflict', 409], ['rate-limit', 429], ['unexpected', 500],
	] as const)('maps %s to %i', async (kind, status) => {
		const handler = jsonEndpoint(async () => {
			throw new ApplicationError(kind as ApplicationErrorKind, 'failure_code', 'Sensitive message')
		})
		const response = await handler({} as never)
		expect(response.status).toBe(status)
		const payload = await response.json()
		expect(payload.error.code).toBe('failure_code')
		expect(payload.error.message).toBe(kind === 'unexpected' ? 'An unexpected error occurred' : 'Sensitive message')
	})
})
