<script lang="ts">
	import LinkSimple from 'phosphor-svelte/lib/LinkSimple'
	import { pushError, pushSuccess } from '$lib/notifications.svelte.js'
	import { cn } from '$lib/utils.js'
	import { rodderViewUrl, type RodderViewState } from '../view-state.js'

	let {
		getState,
		class: className = '',
	}: {
		getState: () => RodderViewState | null
		class?: string
	} = $props()

	async function copyViewLink() {
		const state = getState()
		if (!state) {
			pushError('The view is still getting ready')
			return
		}
		try {
			await navigator.clipboard.writeText(rodderViewUrl(globalThis.location.href, state).toString())
			pushSuccess('View link copied')
		} catch {
			pushError('Could not copy the view link')
		}
	}
</script>

<button
	type="button"
	class={cn('flex items-center gap-1 font-medium text-link transition-colors hover:text-link-hover', className)}
	onclick={copyViewLink}
>
	<LinkSimple size={14} weight="bold" />Copy view link
</button>
