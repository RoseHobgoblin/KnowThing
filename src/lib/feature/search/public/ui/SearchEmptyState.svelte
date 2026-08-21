<script lang="ts">
	let {
		query = '',
		idleMessage = 'Enter a search term to begin.',
		noResultsMessage = 'No results found.',
	}: {
		query?: string
		idleMessage?: string
		noResultsMessage?: string
	} = $props()
</script>

<div class="text-center py-12 text-secondary">
	{#if query}
		<p class="text-lg">{noResultsMessage}</p>
	{:else}
		<p>{idleMessage}</p>
	{/if}
</div>
