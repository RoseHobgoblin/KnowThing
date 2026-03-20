<script lang="ts">
	import type { PageData } from './$types.js';
	import WordbookSearch from '$lib/components/wordbook/WordbookSearch.svelte';
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte';
	import TagPill from '$lib/components/wordbook/TagPill.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.query ? `"${data.query}" — ` : ''}Wordbook Search — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-stone-900 mb-4">Search the Wordbook</h1>
		<WordbookSearch languages={data.languages} />
	</div>

	{#if data.query || data.tag || data.language || data.pos}
		<!-- Active filters -->
		<div class="flex items-center gap-2 flex-wrap text-sm">
			<span class="text-stone-500">Filters:</span>
			{#if data.query}
				<span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
					"{data.query}"
				</span>
			{/if}
			{#if data.language}
				<span class="px-2 py-0.5 bg-stone-100 text-stone-600 rounded border border-stone-200">
					{data.language}
				</span>
			{/if}
			{#if data.tag}
				<TagPill tag={data.tag} />
			{/if}
			{#if data.pos}
				<span class="px-2 py-0.5 bg-stone-100 text-stone-600 rounded border border-stone-200">
					{data.pos}
				</span>
			{/if}
			<a href="/wordbook/search" class="text-xs text-stone-400 hover:text-stone-600">Clear all</a>
		</div>

		<!-- Results -->
		{#if data.results.length > 0}
			<div class="text-sm text-stone-500 mb-2">{data.results.length} result{data.results.length !== 1 ? 's' : ''}</div>
			<div class="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100">
				{#each data.results as entry}
					<WordEntry {entry} />
				{/each}
			</div>
		{:else}
			<div class="text-center py-12 text-stone-400">
				<p class="text-lg">No results found</p>
				<p class="text-sm mt-1">Try a different search term or broader filters</p>
			</div>
		{/if}
	{:else}
		<div class="text-center py-12 text-stone-400">
			<p>Enter a search term or select filters to find words</p>
		</div>
	{/if}
</div>
