import { isHttpError, json } from '@sveltejs/kit'
import type { z } from 'zod'

/**
 * Parse a JSON request body against a Zod schema.
 * Returns the typed data on success, or a 400 JSON response on failure.
 * All validation issues are reported, not just the first.
 */
export async function parseBody<T extends z.ZodTypeAny>(
	request: Request,
	schema: T,
): Promise<z.infer<T> | Response> {
	let body: unknown
	try {
		body = await request.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 })
	}
	const parsed = schema.safeParse(body)
	if (!parsed.success) {
		const issues = parsed.error.issues.map(issue =>
			issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
		)
		return json({ error: issues[0], issues }, { status: 400 })
	}
	return parsed.data
}

/** Map well-known Postgres error codes to clean client responses. */
const PG_ERROR_RESPONSES: Record<string, { status: number, message: string }> = {
	23505: { status: 409, message: 'A record with these values already exists' },
	23503: { status: 400, message: 'A referenced record does not exist' },
	23502: { status: 400, message: 'A required field is missing' },
	23514: { status: 400, message: 'A field value is out of range' },
}

/**
 * Wrap an async function that may throw SvelteKit HTTP errors.
 * Returns the function's result on success, or a structured JSON error response.
 * Known Postgres constraint violations become clean 4xx responses; anything else
 * is logged and returned as an opaque 500 — raw errors never reach the client.
 */
export async function handleServiceCall<T>(function_: () => Promise<T>): Promise<T | Response> {
	try {
		return await function_()
	} catch (error: unknown) {
		if (isHttpError(error)) {
			return json({ error: error.body?.message ?? 'Request failed' }, { status: error.status })
		}
		const pgCode = (error as { code?: string })?.code
		if (pgCode && PG_ERROR_RESPONSES[pgCode]) {
			const { status, message } = PG_ERROR_RESPONSES[pgCode]
			return json({ error: message }, { status })
		}
		// The client gets a structured opaque 500 (below); this is the only place
		// the real error is preserved for the server operator.
		// eslint-disable-next-line local/no-console-server
		console.error('Unhandled service error:', error)
		return json({ error: 'Internal server error' }, { status: 500 })
	}
}

/** Normalize axis values (place/manner/height/backness/subtype) so case or
 * whitespace differences don't silently create divergent columns in the grid
 * (e.g. "Bilabial" vs "bilabial"). Internal whitespace is collapsed. */
export function normalizeAxis(value: string | null | undefined): string | null {
	if (value == null) return null
	const cleaned = value.trim().toLowerCase().replaceAll(/\s+/g, ' ')
	return cleaned || null
}
