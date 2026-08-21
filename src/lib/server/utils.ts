import { isHttpError } from '@sveltejs/kit'
import { APIError } from 'better-auth/api'
import type { z } from 'zod'
import { apiError } from './http/json-endpoint.js'

/**
 * Validate an already-parsed value against a Zod schema.
 * Returns the typed data on success, or a 400 JSON response on failure.
 * All validation issues are reported, not just the first.
 * Use when one request body must be checked against more than one schema
 * (e.g. a discriminator lookup followed by the kind-specific schema).
 */
export function parseInput<T extends z.ZodTypeAny>(body: unknown, schema: T): z.infer<T> | Response {
	const parsed = schema.safeParse(body)
	if (!parsed.success) {
		const issues = parsed.error.issues.map(issue =>
			issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
		)
		return apiError(400, 'validation_failed', issues[0], issues)
	}
	return parsed.data
}

/**
 * Parse a JSON request body against a Zod schema.
 * Returns the typed data on success, or a 400 JSON response on failure.
 */
export async function parseBody<T extends z.ZodTypeAny>(
	request: Request,
	schema: T,
): Promise<z.infer<T> | Response> {
	let body: unknown
	try {
		body = await request.json()
	} catch {
		return apiError(400, 'invalid_json', 'Invalid JSON body')
	}
	return parseInput(body, schema)
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
			return apiError(error.status, `http_${error.status}`, error.body?.message ?? 'Request failed')
		}
		if (error instanceof APIError) {
			return apiError(error.statusCode, `auth_${error.statusCode}`, error.message)
		}
		const pgCode = (error as { code?: string })?.code
		if (pgCode && PG_ERROR_RESPONSES[pgCode]) {
			const { status, message } = PG_ERROR_RESPONSES[pgCode]
			return apiError(status, `database_${pgCode}`, message)
		}
		// The client gets a structured opaque 500 (below); this is the only place
		// the real error is preserved for the server operator.
		// eslint-disable-next-line local/no-console-server
		console.error('Unhandled service error:', error)
		return apiError(500, 'internal_error', 'An unexpected error occurred')
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
