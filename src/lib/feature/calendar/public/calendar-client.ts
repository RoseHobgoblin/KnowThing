import { requestJson } from '$lib/transport/json.js'

export function createCalendar<T>(body: unknown) {
	return requestJson<T>('POST', '/api/calendar', body)
}

export function saveCalendar<T>(id: number, method: 'PATCH' | 'PUT' | 'DELETE', body?: unknown) {
	return requestJson<T>(method, `/api/calendar/${id}`, body)
}
