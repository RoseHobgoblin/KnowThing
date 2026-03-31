<script lang="ts">
	let {
		action = '/search',
		query = '',
		scope = 'all',
		placeholder = 'Search KnowThing',
		hiddenFields = {},
	}: {
		action?: string
		query?: string
		scope?: string
		placeholder?: string
		hiddenFields?: Record<string, string | undefined>
	} = $props()
</script>

<form {action} method="GET" class="flex flex-wrap gap-3 items-end">
	<div class="min-w-[220px] flex-1">
		<label for="search-q" class="block text-xs font-medium text-secondary mb-1">Search</label>
		<input
			id="search-q"
			name="q"
			value={query}
			placeholder={placeholder}
			class="w-full px-3 py-2 border border-border-strong text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
		/>
	</div>
	<input type="hidden" name="scope" value={scope} />
	{#each Object.entries(hiddenFields) as [key, value]}
		{#if value}
			<input type="hidden" name={key} value={value} />
		{/if}
	{/each}
	<button type="submit" class="px-4 py-2 bg-accent text-surface text-sm hover:bg-accent-hover">Search</button>
</form>
