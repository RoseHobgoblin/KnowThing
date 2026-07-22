/** Minimal JSON wrapper for the app's API routes. Throws an Error carrying the
 * server's structured `{ error }` message on non-2xx responses, so callers
 * (and TanStack mutation `onError` handlers) can show it directly. */
export async function api<T = unknown>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	url: string,
	body?: unknown,
): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	})
	if (!response.ok) {
		const payload = await response.json().catch(() => null) as { error?: string } | null
		throw new Error(payload?.error ?? `Request failed (${response.status})`)
	}
	return response.json().catch(() => undefined) as Promise<T>
}
