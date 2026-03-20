<script lang="ts">
	import type { PageData } from './$types.js';
	import WordbookSearch from '$lib/components/wordbook/WordbookSearch.svelte';
	import LanguageCard from '$lib/components/wordbook/LanguageCard.svelte';
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-8">
	<!-- Hero -->
	<div class="text-center py-6">
		<h1 class="text-3xl font-bold text-stone-900 mb-2">Wordbook</h1>
		<p class="text-stone-500 mb-6">
			{data.totalWords} {data.totalWords === 1 ? 'word' : 'words'} across {data.languages.length} {data.languages.length === 1 ? 'language' : 'languages'}
		</p>
		<div class="max-w-2xl mx-auto">
			<WordbookSearch languages={data.languages} large />
		</div>
	</div>

	<!-- Languages -->
	{#if data.languages.length > 0}
		<section>
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-lg font-semibold text-stone-800">Languages</h2>
				<a href="/wordbook/contribute/language" class="text-sm text-amber-700 hover:text-amber-900 hover:underline">+ Add language</a>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each data.languages as lang}
					<LanguageCard
						name={lang.name}
						slug={lang.slug}
						nativeName={lang.nativeName}
						family={lang.family}
						script={lang.script}
						color={lang.color || '#d97706'}
						wordCount={Number(lang.wordCount)}
					/>
				{/each}
			</div>
		</section>
	{:else}
		<div class="text-center py-12 text-stone-400">
			<p class="text-lg mb-2">No languages yet</p>
			<p class="text-sm">
				<a href="/wordbook/contribute/language" class="text-amber-700 hover:underline">Add a language</a> to get started.
			</p>
		</div>
	{/if}

	<!-- Recent -->
	{#if data.recent.length > 0}
		<section>
			<h2 class="text-lg font-semibold text-stone-800 mb-3">Recently Added</h2>
			<div class="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100">
				{#each data.recent as entry}
					<WordEntry {entry} />
				{/each}
			</div>
		</section>
	{/if}
</div>
