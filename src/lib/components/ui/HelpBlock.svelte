<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		title = 'What is this?',
		open = false,
		class: className = '',
		children,
	}: {
		title?: string
		open?: boolean
		class?: string
		children: Snippet<[]>
	} = $props()

	let showHelp = $state(open)
</script>

<div class={className}>
	<button
		type="button"
		onclick={() => showHelp = !showHelp}
		class="text-xs text-secondary rounded-sm px-1.5 py-0.5 hover:text-link"
	>
		{showHelp ? `Hide ${title.toLowerCase()}` : title}
	</button>

	{#if showHelp}
		<div class="mt-2 p-3 bg-page text-xs text-secondary space-y-2">
			{@render children()}
		</div>
	{/if}
</div>
