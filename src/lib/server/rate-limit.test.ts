import { describe, expect, it } from 'vitest'
import type { RequestEvent } from '@sveltejs/kit'
import {
	RATE_LIMIT_BUCKETS,
	bucketFor,
	enforceRateLimit,
	rateLimitedResponse,
} from './rate-limit.js'

/** Minimal stand-in for the fields `enforceRateLimit` actually reads. */
function fakeEvent(pathname: string, method: string, ip: string): RequestEvent {
	return {
		url: new URL(`https://knowthing.al${pathname}`),
		request: new Request(`https://knowthing.al${pathname}`, { method }),
		getClientAddress: () => ip,
	} as unknown as RequestEvent
}

describe('bucket classification', () => {
	it('leaves page navigation unmetered', () => {
		expect(bucketFor('/', 'GET')).toBeNull()
		expect(bucketFor('/know/some_article', 'GET')).toBeNull()
		expect(bucketFor('/auth/login', 'GET')).toBeNull()
	})

	it('separates served files and search from ordinary data reads', () => {
		expect(bucketFor('/api/pages', 'GET')).toBe('read')
		expect(bucketFor('/api/media/photo.jpg', 'GET')).toBe('media')
		expect(bucketFor('/api/search', 'GET')).toBe('search')
	})

	it('routes every mutation to a bucket, defaulting to write', () => {
		expect(bucketFor('/api/pages/1', 'PUT')).toBe('write')
		expect(bucketFor('/api/languages/oncheran', 'DELETE')).toBe('write')
		expect(bucketFor('/api/render', 'POST')).toBe('render')
		expect(bucketFor('/api/media', 'POST')).toBe('upload')
	})

	it('meters Better Auth sign-in over HTTP as credentials', () => {
		expect(bucketFor('/api/auth/sign-in/username', 'POST')).toBe('credentials')
		expect(bucketFor('/api/auth/sign-up/email', 'POST')).toBe('credentials')
	})

	it('leaves the login and register form actions to the actions themselves', () => {
		// They spend from `credentials` inside the action so a lockout can be
		// rendered as an ActionFailure. The hook still counts them as ordinary
		// writes, which only bites under flooding — far above what the
		// credentials budget allows a human to reach.
		expect(bucketFor('/auth/login', 'POST')).toBe('write')
		expect(bucketFor('/auth/register', 'POST')).toBe('write')
	})

	it('does not let a prefix match leak across route boundaries', () => {
		// `/api/mediation` must not be mistaken for something under `/api/media`.
		expect(bucketFor('/api/mediation', 'GET')).toBe('read')
		expect(bucketFor('/apifoo', 'GET')).toBeNull()
	})
})

describe('enforcement', () => {
	it('spends from the matching bucket and reports what is left', async () => {
		const first = await enforceRateLimit(fakeEvent('/api/pages', 'GET', '198.51.100.1'))
		expect(first).toMatchObject({
			bucket: 'read',
			allowed: true,
			limit: RATE_LIMIT_BUCKETS.read.points,
			remaining: RATE_LIMIT_BUCKETS.read.points - 1,
		})
	})

	it('returns null — not a decision — for unmetered requests', async () => {
		expect(await enforceRateLimit(fakeEvent('/know/article', 'GET', '198.51.100.2'))).toBeNull()
	})

	it('keeps budgets separate per client address', async () => {
		await enforceRateLimit(fakeEvent('/api/pages', 'GET', '198.51.100.3'))
		await enforceRateLimit(fakeEvent('/api/pages', 'GET', '198.51.100.3'))
		const other = await enforceRateLimit(fakeEvent('/api/pages', 'GET', '198.51.100.4'))
		expect(other?.remaining).toBe(RATE_LIMIT_BUCKETS.read.points - 1)
	})

	it('keeps budgets separate per bucket', async () => {
		const ip = '198.51.100.5'
		await enforceRateLimit(fakeEvent('/api/media/a.png', 'GET', ip))
		const read = await enforceRateLimit(fakeEvent('/api/pages', 'GET', ip))
		expect(read?.remaining).toBe(RATE_LIMIT_BUCKETS.read.points - 1)
	})

	it('rejects once the bucket is spent', async () => {
		const ip = '198.51.100.6'
		const limit = RATE_LIMIT_BUCKETS.upload.points
		for (let index = 0; index < limit; index++) {
			const ok = await enforceRateLimit(fakeEvent('/api/media', 'POST', ip))
			expect(ok?.allowed).toBe(true)
		}

		const denied = await enforceRateLimit(fakeEvent('/api/media', 'POST', ip))
		expect(denied).toMatchObject({ bucket: 'upload', allowed: false, remaining: 0 })
		expect(denied!.resetSeconds).toBeGreaterThan(0)
	})
})

describe('429 response', () => {
	const decision = {
		bucket: 'write',
		allowed: false,
		limit: 60,
		remaining: 0,
		resetSeconds: 42,
	} as const

	it('carries retry guidance in the headers', () => {
		const response = rateLimitedResponse(fakeEvent('/api/pages', 'POST', '1.1.1.1'), decision)
		expect(response.status).toBe(429)
		expect(response.headers.get('Retry-After')).toBe('42')
		expect(response.headers.get('RateLimit-Limit')).toBe('60')
		expect(response.headers.get('RateLimit-Remaining')).toBe('0')
	})

	it('speaks JSON to API callers and plain text to form posts', async () => {
		const api = rateLimitedResponse(fakeEvent('/api/pages', 'POST', '1.1.1.1'), decision)
		expect(api.headers.get('Content-Type')).toBe('application/json')
		expect(await api.json()).toEqual({
			error: { code: 'rate_limited', message: expect.stringContaining('42 seconds') },
		})

		const form = rateLimitedResponse(fakeEvent('/auth/login', 'POST', '1.1.1.1'), decision)
		expect(form.headers.get('Content-Type')).toContain('text/plain')
		expect(await form.text()).toContain('Too many requests')
	})
})
