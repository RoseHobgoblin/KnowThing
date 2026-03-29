import { browser } from '$app/environment'

export type NotificationType = {
	message: string
	id: number
	expired: boolean
	type?: 'info' | 'success' | 'error'
	loading?: boolean
	duration?: number
}

let notificationId = $state<number>(1)

export const notifications = $state<NotificationType[]>([])

export function pushNotification(
	notification: string | Omit<NotificationType, 'id' | 'expired'>,
	options: { duration?: number, loading?: boolean } = { duration: 5000 },
): number {
	if (!browser) return 0

	if (typeof notification === 'string') {
		notification = { message: notification }
	}

	// Deduplicate
	const existing = notifications.find(
		n => !n.expired && n.message === notification.message && n.type === notification.type,
	)
	if (existing) return existing.id

	const newId = ++notificationId
	const duration = options.duration ?? 5000

	notifications.unshift({
		...notification,
		id: newId,
		expired: false,
		loading: options.loading,
		duration,
	})

	if (duration > 0) {
		setTimeout(() => expireNotification(newId), duration)
	}

	return newId
}

export function pushSuccess(message: string, options?: { duration?: number }) {
	return pushNotification({ message, type: 'success' }, options)
}

export function pushError(message: string, options?: { duration?: number }) {
	return pushNotification({ message, type: 'error' }, options)
}

export function removeNotification(id: number): boolean {
	if (!browser) return false
	const index = notifications.findIndex(item => item.id === id)
	if (index === -1) return false
	notifications.splice(index, 1)
	return true
}

export function expireNotification(id: number): boolean {
	if (!browser) return false
	const notification = notifications.find(item => item.id === id)
	if (!notification || notification.expired) return false
	setTimeout(() => removeNotification(id), 400)
	return notification.expired = true
}
