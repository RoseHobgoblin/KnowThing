import type { Server } from 'bun'
import { Elysia } from 'elysia'

export type SvelteKitFetch = (
	request: Request,
	server: Server,
) => Response | Promise<Response>

/**
 * Elysia owns the Bun listener. SvelteKit remains the application router and
 * receives the original Request so actions, forms, and uploads consume the
 * body exactly once.
 */
export function createApp(svelteKitFetch: SvelteKitFetch) {
	return new Elysia({ name: 'knowthing' })
		.get('/healthz', () => ({
			status: 'ok',
			runtime: 'bun',
			server: 'elysia',
		}))
		.all(
			'*',
			({ request, server }) => {
				if (!server) {
					return new Response('HTTP server is not ready', { status: 503 })
				}
				return svelteKitFetch(request, server)
			},
			{ parse: 'none' },
		)
}
