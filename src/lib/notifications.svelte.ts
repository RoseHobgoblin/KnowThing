import { browser } from '$app/environment'

export type NotificationAction = {
	label: string
	onclick: () => void
}

export type NotificationType = {
	message: string
	id: number
	expired: boolean
	type?: 'info' | 'success' | 'error'
	loading?: boolean
	duration?: number
	/** Optional action button rendered inline (e.g. "Undo"). Clicking it fires
	 * `onclick` then dismisses the notification. */
	action?: NotificationAction
	/** Fires when the notification expires without the action being clicked.
	 * Use for undo-style flows where expiry = commit the deferred operation. */
	onExpire?: () => void
	/** Internal: true if the action was clicked — suppresses onExpire. */
	actioned?: boolean
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

	// Skip deduplication for notifications with actions — each one represents
	// a distinct undo target with its own callback, so merging would drop
	// later pending operations silently.
	if (!notification.action) {
		const existing = notifications.find(
			n => !n.expired && n.message === notification.message && n.type === notification.type,
		)
		if (existing) return existing.id
	}

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

/** Shortcut for undo toasts. `duration` is the undo window (default 6s);
 * `onUndo` restores, `onExpire` commits the operation. */
export function pushUndoable(
	message: string,
	onUndo: () => void,
	onExpire: () => void,
	options: { duration?: number, label?: string } = {},
): number {
	return pushNotification({
		message,
		type: 'info',
		action: { label: options.label ?? 'Undo', onclick: onUndo },
		onExpire,
	}, { duration: options.duration ?? 6000 })
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
	if (!notification.actioned) notification.onExpire?.()
	setTimeout(() => removeNotification(id), 400)
	return notification.expired = true
}

/** Called by the Notification component when the inline action is clicked.
 * Marks the notification as actioned (so expiry won't also fire onExpire),
 * runs the action, and dismisses. */
export function triggerNotificationAction(id: number): void {
	if (!browser) return
	const notification = notifications.find(item => item.id === id)
	if (!notification || notification.expired) return
	notification.actioned = true
	notification.action?.onclick()
	expireNotification(id)
}
