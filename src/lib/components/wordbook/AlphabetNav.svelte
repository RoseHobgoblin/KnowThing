<script lang="ts">
	let { activeLetters = [], currentLetter = '', baseUrl = '' }: {
		activeLetters?: string[]
		currentLetter?: string
		baseUrl?: string
	} = $props()

	const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
	const activeSet = new Set(activeLetters.map(l => l.toUpperCase()))
</script>

<nav class="flex flex-wrap gap-1 py-3">
	<a
		href={baseUrl}
		class="size-7 flex items-center justify-center rounded-sm text-xs font-medium transition-colors
			{currentLetter ? 'text-secondary hover:bg-accent-subtle hover:text-link' : 'bg-accent text-surface'}"
	>All</a>
	{#each alphabet as letter}
		{@const isActive = activeSet.has(letter)}
		{@const isCurrent = currentLetter.toUpperCase() === letter}
		{#if isActive}
			<a
				href="{baseUrl}?letter={letter.toLowerCase()}"
				class="size-7 flex items-center justify-center rounded-sm text-xs font-medium transition-colors
					{isCurrent ? 'bg-accent text-surface' : 'text-secondary hover:bg-accent-subtle hover:text-link'}"
			>{letter}</a>
		{:else}
			<span class="size-7 flex items-center justify-center rounded-sm text-xs text-faint">{letter}</span>
		{/if}
	{/each}
</nav>
