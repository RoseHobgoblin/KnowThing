<script lang="ts">
	import { expireNotification, type NotificationType } from '$lib/notifications.svelte.ts'
	import { cn } from '$lib/utils'

	const { notification }: { notification: NotificationType } = $props()

	const colors = {
		info: { icon: 'text-link', bar: 'bg-link' },
		success: { icon: 'text-success', bar: 'bg-success' },
		error: { icon: 'text-error-hover', bar: 'bg-error' },
	}

	const icons = { info: 'ℹ', success: '✓', error: '!' }

	const variant = $derived(notification.type ?? 'info')

	function onclick() {
		expireNotification(notification.id)
	}
</script>

<button
	{onclick}
	class={cn(
		'relative flex items-center gap-3 px-4 py-3 bg-surface border border-border shadow-lg cursor-pointer animate-slide-in min-w-64 max-w-sm overflow-hidden text-left',
		notification.expired && 'animate-slide-out',
	)}
>
	<div class={cn('size-7 flex items-center justify-center bg-raised shrink-0 text-sm font-bold', colors[variant].icon)}>
		{#if notification.loading}
			<span class="animate-spin">⟳</span>
		{:else}
			{icons[variant]}
		{/if}
	</div>

	<p class="text-sm text-body">{notification.message}</p>

	{#if notification.duration && notification.duration > 0}
		<div
			class={cn('absolute bottom-0 left-0 h-0.5 origin-left animate-progress-shrink', colors[variant].bar)}
			style="animation-duration: {notification.duration}ms"
		></div>
	{/if}
</button>

<style>
	@keyframes slide-in {
		from { transform: translateY(100%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	@keyframes slide-out {
		from { transform: translateY(0); opacity: 1; max-height: 200px; margin-top: 0.5rem; }
		to { transform: translateY(100%); opacity: 0; max-height: 0; margin-top: 0; }
	}

	@keyframes progress-shrink {
		from { width: 100%; }
		to { width: 0%; }
	}

	.animate-slide-in { animation: slide-in 0.15s ease-out forwards; }
	.animate-slide-out { animation: slide-out 0.3s ease-in forwards; }
	.animate-progress-shrink { animation: progress-shrink linear forwards; }
</style>
