import { describe, expect, it, vi } from 'vitest'
import { createApp } from './elysia-app.js'

describe('Elysia production host', () => {
	it('exposes Bun and Elysia health metadata without invoking SvelteKit', async () => {
		const svelteKitFetch = vi.fn()
		const response = await createApp(svelteKitFetch).handle(
			new Request('http://localhost/healthz'),
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			status: 'ok',
			runtime: 'bun',
			server: 'elysia',
		})
		expect(svelteKitFetch).not.toHaveBeenCalled()
	})

	it('fails closed if the SvelteKit fallback is called without a listener', async () => {
		const svelteKitFetch = vi.fn()
		const response = await createApp(svelteKitFetch).handle(
			new Request('http://localhost/wiki'),
		)

		expect(response.status).toBe(503)
		expect(svelteKitFetch).not.toHaveBeenCalled()
	})
})
