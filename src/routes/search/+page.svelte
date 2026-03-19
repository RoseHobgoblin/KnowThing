<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Search: {data.query} - KnowThing</title>
</svelte:head>

<h1 class="text-2xl  font-bold mb-4">
	{#if data.query}Search results for "{data.query}"{:else}Search{/if}
</h1>

{#if data.results.length === 0 && data.query}
	<p class="text-stone-600">No results found for "{data.query}".</p>
{:else}
	<div class="space-y-4">
		{#each data.results as r}
			<div>
				<a href="/know/{r.slug}" class="text-lg text-amber-700 hover:underline font-medium">{r.title}</a>
				{#if r.snippet}
					<p class="text-sm text-stone-600 mt-0.5">{@html r.snippet}</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
