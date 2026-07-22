import { browser } from '$app/environment'
import { SvelteMap } from 'svelte/reactivity'
import { toast } from 'svelte-sonner'

type PushOptions = { duration?: number }

/** Active non-action toasts keyed by `type:message`, so repeated pushes of the
 * same message refresh the existing toast instead of stacking duplicates. */
const active = new SvelteMap<string, string | number>()

function push(
	type: 'info' | 'success' | 'error',
	message: string,
	options: PushOptions = {},
): string | number {
	if (!browser) return 0
	const key = `${type}:${message}`
	const clear = () => active.delete(key)
	const id = toast[type](message, {
		id: active.get(key),
		duration: options.duration === 0 ? Number.POSITIVE_INFINITY : options.duration ?? 5000,
		onDismiss: clear,
		onAutoClose: clear,
	})
	active.set(key, id)
	return id
}

export function pushNotification(message: string, options?: PushOptions): string | number {
	return push('info', message, options)
}

export function pushSuccess(message: string, options?: PushOptions): string | number {
	return push('success', message, options)
}

export function pushError(message: string, options?: PushOptions): string | number {
	return push('error', message, options)
}

/** Undo toast. `duration` is the undo window (default 6s); `onUndo` restores,
 * `onExpire` commits the deferred operation. Leaving the toast any way other
 * than clicking the action — auto-expiry or manual dismissal — commits. */
export function pushUndoable(
	message: string,
	onUndo: () => void,
	onExpire: () => void,
	options: { duration?: number, label?: string } = {},
): string | number {
	if (!browser) return 0
	let actioned = false
	const commit = () => {
		if (actioned) return
		actioned = true
		onExpire()
	}
	return toast.info(message, {
		duration: options.duration ?? 6000,
		action: {
			label: options.label ?? 'Undo',
			onClick: () => {
				actioned = true
				onUndo()
			},
		},
		onDismiss: commit,
		onAutoClose: commit,
	})
}
