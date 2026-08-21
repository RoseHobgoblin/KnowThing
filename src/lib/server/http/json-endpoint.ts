import { isHttpError, json, type RequestHandler } from '@sveltejs/kit'
import { isApplicationError, type ApplicationErrorKind } from '$lib/application/errors.js'
import type { ApiErrorPayload } from '$lib/transport/json.js'

const STATUS_BY_KIND: Record<ApplicationErrorKind, number> = {
	'validation': 400,
	'unauthenticated': 401,
	'forbidden': 403,
	'missing': 404,
	'conflict': 409,
	'rate-limit': 429,
	'unexpected': 500,
}

export function apiError(
	status: number,
	code: string,
	message: string,
	details?: unknown,
) {
	const payload: ApiErrorPayload = {
		error: {
			code,
			message,
			...(details === undefined ? {} : { details }),
		},
	}
	return json(payload, { status })
}

export function jsonEndpoint(handler: RequestHandler): RequestHandler {
	return async (event) => {
		try {
			return await handler(event)
		} catch (error) {
			if (isApplicationError(error)) {
				const status = STATUS_BY_KIND[error.kind]
				return apiError(
					status,
					error.code,
					error.kind === 'unexpected' ? 'An unexpected error occurred' : error.message,
					error.kind === 'unexpected' ? undefined : error.details,
				)
			}
			if (isHttpError(error)) {
				const message = typeof error.body?.message === 'string' ? error.body.message : 'Request failed'
				return apiError(error.status, `http_${error.status}`, message)
			}
			return apiError(500, 'internal_error', 'An unexpected error occurred')
		}
	}
}

/** Normalize legacy/third-party JSON failures at the API boundary. Successful
 * responses are returned by identity so their body and headers stay untouched. */
export async function normalizeApiErrorResponse(response: Response): Promise<Response> {
	if (response.ok) return response
	const contentType = response.headers.get('content-type') ?? ''
	const disposition = response.headers.get('content-disposition') ?? ''
	if (contentType.startsWith('application/octet-stream')
		|| contentType.startsWith('image/')
		|| disposition.toLowerCase().includes('attachment')) return response
	if (!contentType.includes('application/json')) {
		return apiError(response.status, statusCode(response.status), defaultStatusMessage(response.status))
	}
	const payload: unknown = await response.clone().json().catch(() => null)
	if (payload && typeof payload === 'object') {
		const value = payload as { error?: unknown, issues?: unknown }
		if (value.error && typeof value.error === 'object') return response
		if (typeof value.error === 'string') {
			return apiError(response.status, statusCode(response.status), value.error, value.issues)
		}
	}
	return apiError(response.status, statusCode(response.status), defaultStatusMessage(response.status))
}

function statusCode(status: number): string {
	return ({ 400: 'invalid_request', 401: 'unauthenticated', 403: 'forbidden', 404: 'missing', 409: 'conflict', 429: 'rate_limited' } as Record<number, string>)[status] ?? 'internal_error'
}

function defaultStatusMessage(status: number): string {
	return status >= 500 ? 'An unexpected error occurred' : 'Request failed'
}
