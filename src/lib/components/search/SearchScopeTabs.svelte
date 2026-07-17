<script lang="ts">
	let {
		scopes,
		currentScope,
	}: {
		scopes: Array<{ value: string; label: string; count?: number; href: string }>
		currentScope: string
	} = $props()
</script>

<div class="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
	{#each scopes as scope}
		<a
			href={scope.href}
			class="px-3 py-1.5 text-sm border transition-colors {currentScope === scope.value ? 'border-accent-border bg-accent-subtle text-link' : 'border-border text-secondary hover:bg-page'}"
		>
			{scope.label}
			{#if scope.count !== undefined}
				<span class="ml-1 text-xs text-secondary">({scope.count})</span>
			{/if}
		</a>
	{/each}
</div>
