<script lang="ts">
	let { activeLetters = [], currentLetter = '', baseUrl = '' }: {
		activeLetters?: string[];
		currentLetter?: string;
		baseUrl?: string;
	} = $props();

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
	const activeSet = new Set(activeLetters.map(l => l.toUpperCase()));
</script>

<nav class="flex flex-wrap gap-1 py-3">
	<a
		href={baseUrl}
		class="w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors
			{!currentLetter ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-amber-50 hover:text-amber-700'}"
	>All</a>
	{#each alphabet as letter}
		{@const isActive = activeSet.has(letter)}
		{@const isCurrent = currentLetter.toUpperCase() === letter}
		{#if isActive}
			<a
				href="{baseUrl}?letter={letter.toLowerCase()}"
				class="w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors
					{isCurrent ? 'bg-amber-600 text-white' : 'text-stone-700 hover:bg-amber-50 hover:text-amber-700'}"
			>{letter}</a>
		{:else}
			<span class="w-7 h-7 flex items-center justify-center rounded text-xs text-stone-300">{letter}</span>
		{/if}
	{/each}
</nav>
