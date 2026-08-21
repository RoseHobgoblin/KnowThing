import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, requestJson } from './json.js'

afterEach(() => vi.unstubAllGlobals())

describe('requestJson', () => {
	it('returns a raw successful payload', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 1 })))
		await expect(requestJson<{ id: number }>('GET', '/api/example')).resolves.toEqual({ id: 1 })
	})

	it('throws a typed API error', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({
			error: { code: 'missing_example', message: 'Example not found' },
		}, { status: 404 })))
		const failure = await requestJson('GET', '/api/example').catch(error => error)
		expect(failure).toBeInstanceOf(ApiClientError)
		expect(failure).toMatchObject({ status: 404, code: 'missing_example', message: 'Example not found' })
	})
})
