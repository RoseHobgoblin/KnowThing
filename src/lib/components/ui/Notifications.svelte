<script lang="ts">
	import Notification from './Notification.svelte'
	import { notifications } from '$lib/notifications.svelte.ts'
</script>

<div class="fixed z-[10000] flex flex-col-reverse items-center gap-2 bottom-4 left-1/2 -translate-x-1/2">
	{#each notifications as notification (notification.id)}
		<Notification {notification} />
	{/each}
</div>
