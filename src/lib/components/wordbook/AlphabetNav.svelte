<script lang="ts">
	let { activeLetters = [], currentLetter = '', baseUrl = '' }: {
		activeLetters?: string[]
		currentLetter?: string
		baseUrl?: string
	} = $props()

	const sorted = $derived(
		[...activeLetters].map(l => l.toUpperCase()).sort((a, b) => a.localeCompare(b))
	)
</script>

{#if sorted.length > 0}
	<nav class="flex flex-wrap gap-1 py-3">
		<a
			href={baseUrl}
			class="px-2 py-1 flex items-center justify-center text-xs font-medium transition-colors
				{currentLetter ? 'text-secondary hover:bg-accent-subtle hover:text-link' : 'bg-accent text-surface'}"
		>All</a>
		{#each sorted as letter (letter)}
			{@const isCurrent = currentLetter.toUpperCase() === letter}
			<a
				href="{baseUrl}?letter={letter.toLowerCase()}"
				class="px-2 py-1 flex items-center justify-center text-xs font-medium transition-colors
					{isCurrent ? 'bg-accent text-surface' : 'text-secondary hover:bg-accent-subtle hover:text-link'}"
			>{letter}</a>
		{/each}
	</nav>
{/if}
