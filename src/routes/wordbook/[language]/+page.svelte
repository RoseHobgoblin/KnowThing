<script lang="ts">
	import type { PageData } from './$types.js';
	import AlphabetNav from '$lib/components/wordbook/AlphabetNav.svelte';
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte';

	let { data }: { data: PageData } = $props();

	// Group entries by first letter
	function groupByLetter(entries: typeof data.entries) {
		const groups: Record<string, typeof entries> = {};
		for (const entry of entries) {
			const letter = entry.word[0].toUpperCase();
			if (!groups[letter]) groups[letter] = [];
			groups[letter].push(entry);
		}
		return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
	}

	const grouped = $derived(groupByLetter(data.entries));
</script>

<svelte:head>
	<title>{data.language.name} — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Language header -->
	<div>
		<div class="flex items-baseline gap-3 mb-1">
			<h1 class="text-3xl font-bold text-stone-900">{data.language.name}</h1>
			{#if data.language.nativeName}
				<span class="text-lg text-stone-400 italic">{data.language.nativeName}</span>
			{/if}
		</div>

		<div class="flex items-center gap-3 text-sm text-stone-500 mb-3">
			{#if data.language.family}
				<span>{data.language.family} family</span>
			{/if}
			{#if data.language.script}
				<span class="text-stone-300">·</span>
				<span>{data.language.script} script</span>
			{/if}
			<span class="text-stone-300">·</span>
			<span style="color: {data.language.color};" class="font-medium">{Number(data.language.wordCount)} words</span>
		</div>

		{#if data.language.description}
			<p class="text-stone-600 leading-relaxed">{data.language.description}</p>
		{/if}
	</div>

	<!-- Alphabet nav -->
	<div class="border-y border-stone-200 bg-white px-2">
		<AlphabetNav
			activeLetters={data.activeLetters}
			currentLetter={data.currentLetter}
			baseUrl="/wordbook/{data.language.slug}"
		/>
	</div>

	<!-- Entries -->
	{#if data.entries.length > 0}
		{#each grouped as [letter, entries]}
			<section>
				<h2 class="text-xl font-bold text-stone-300 mb-2 pl-1" id="letter-{letter}">{letter}</h2>
				<div class="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100">
					{#each entries as entry}
						<WordEntry {entry} showLanguage={false} compact />
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<div class="text-center py-12 text-stone-400">
			{#if data.currentLetter}
				<p>No words starting with "{data.currentLetter.toUpperCase()}"</p>
			{:else}
				<p class="text-lg mb-2">No words yet</p>
				<p class="text-sm">
					<a href="/wordbook/contribute" class="text-amber-700 hover:underline">Add the first word</a>
				</p>
			{/if}
		</div>
	{/if}
</div>
