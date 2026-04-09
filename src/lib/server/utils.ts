import { isHttpError, json } from '@sveltejs/kit'
import type { z } from 'zod'

/**
 * Parse a JSON request body against a Zod schema.
 * Returns the typed data on success, or a 400 JSON response on failure.
 */
export async function parseBody<T extends z.ZodTypeAny>(
	request: Request,
	schema: T,
): Promise<z.infer<T> | Response> {
	const body = await request.json()
	const parsed = schema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}
	return parsed.data
}

/**
 * Wrap an async function that may throw SvelteKit HTTP errors.
 * Returns the function's result on success, or a JSON error response
 * if an HttpError is thrown. Non-HTTP errors are re-thrown.
 */
export async function handleServiceCall<T>(function_: () => Promise<T>): Promise<T | Response> {
	try {
		return await function_()
	} catch (error: unknown) {
		if (isHttpError(error)) {
			return json({ error: error.body?.message ?? 'Request failed' }, { status: error.status })
		}
		throw error
	}
}
