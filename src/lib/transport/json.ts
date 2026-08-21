export type ApiErrorPayload = {
	error: {
		code: string
		message: string
		details?: unknown
	}
}

export class ApiClientError extends Error {
	readonly status: number
	readonly code: string
	readonly details?: unknown

	constructor(status: number, payload: ApiErrorPayload['error']) {
		super(payload.message)
		this.name = 'ApiClientError'
		this.status = status
		this.code = payload.code
		this.details = payload.details
	}
}

export type RequestJsonOptions = Omit<RequestInit, 'method' | 'body'>

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
	if (typeof value !== 'object' || value === null) return false
	const error = (value as { error?: unknown }).error
	return typeof error === 'object'
		&& error !== null
		&& typeof (error as { code?: unknown }).code === 'string'
		&& typeof (error as { message?: unknown }).message === 'string'
}

export async function requestJson<T = unknown>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	url: string,
	body?: unknown,
	options: RequestJsonOptions = {},
): Promise<T> {
	const headers = new Headers(options.headers)
	if (body !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json')
	}
	let requestBody: BodyInit | undefined
	if (body instanceof FormData) requestBody = body
	else if (body !== undefined) requestBody = JSON.stringify(body)
	const response = await fetch(url, {
		...options,
		method,
		headers,
		body: requestBody,
	})
	if (!response.ok) {
		const payload: unknown = await response.json().catch(() => null)
		if (isApiErrorPayload(payload)) throw new ApiClientError(response.status, payload.error)
		throw new ApiClientError(response.status, {
			code: 'invalid_error_response',
			message: `Request failed (${response.status})`,
		})
	}
	return response.json().catch(() => undefined) as Promise<T>
}
