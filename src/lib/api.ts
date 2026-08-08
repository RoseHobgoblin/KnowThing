/** Minimal JSON wrapper for the app's API routes. Throws an Error carrying the
 * server's structured `{ error }` message on non-2xx responses, so callers
 * (and TanStack mutation `onError` handlers) can show it directly. */
export async function api<T = unknown>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	url: string,
	body?: unknown,
	options: Omit<RequestInit, 'method' | 'body'> = {},
): Promise<T> {
	const headers = new Headers(options.headers)
	if (body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
	const response = await fetch(url, {
		...options,
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	})
	if (!response.ok) {
		const payload = await response.json().catch(() => null) as { error?: string } | null
		throw new Error(payload?.error ?? `Request failed (${response.status})`)
	}
	return response.json().catch(() => undefined) as Promise<T>
}
