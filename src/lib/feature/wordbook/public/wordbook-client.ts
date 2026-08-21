import { requestJson, type RequestJsonOptions } from '$lib/transport/json.js'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function languageRequest<T>(method: Method, languageSlug: string, resource = '', body?: unknown, options?: RequestJsonOptions) {
	const suffix = resource ? `/${resource}` : ''
	return requestJson<T>(method, `/api/languages/${encodeURIComponent(languageSlug)}${suffix}`, body, options)
}

export function wordbookEntryRequest<T>(method: Method, entryId: number, resource = '', body?: unknown, options?: RequestJsonOptions) {
	const suffix = resource ? `/${resource}` : ''
	return requestJson<T>(method, `/api/wordbook/${entryId}${suffix}`, body, options)
}

export function searchWordbook<T>(query: string, limit: number) {
	return requestJson<T>('GET', `/api/wordbook?q=${encodeURIComponent(query)}&limit=${limit}`)
}
