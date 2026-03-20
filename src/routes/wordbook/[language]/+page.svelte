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
	<!-- Ancestry breadcrumb -->
	{#if data.ancestryChain.length > 1}
		<nav class="flex items-center gap-1 text-sm text-stone-500 flex-wrap">
			{#each data.ancestryChain as ancestor, i}
				{#if i > 0}<span class="text-stone-300">›</span>{/if}
				{#if ancestor.id === data.language.id}
					<span class="text-stone-700 font-medium">{ancestor.name}</span>
				{:else}
					<a href="/wordbook/{ancestor.slug}" class="hover:text-amber-700">{ancestor.name}</a>
				{/if}
			{/each}
		</nav>
	{/if}

	<!-- Language header -->
	<div>
		<div class="flex items-start justify-between mb-1">
			<div class="flex items-baseline gap-3">
				<h1 class="text-3xl font-bold text-stone-900">{data.language.name}</h1>
				{#if data.language.nativeName}
					<span class="text-lg text-stone-400 italic">{data.language.nativeName}</span>
				{/if}
			</div>
			<a href="/wordbook/contribute/language/{data.language.slug}" class="text-sm text-amber-700 hover:text-amber-900 hover:underline shrink-0">Edit language</a>
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

		{#if data.language.pageSlug}
			<a href="/know/{data.language.pageSlug}" class="inline-block mt-2 text-sm text-amber-700 hover:text-amber-900 hover:underline">
				Read the full article →
			</a>
		{/if}
	</div>

	<!-- Child languages -->
	{#if data.children.length > 0}
		<div class="bg-white rounded-lg border border-stone-200 p-4">
			<h3 class="text-sm font-semibold text-stone-800 mb-2">Descendant languages</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.children as child}
					<a href="/wordbook/{child.slug}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-sm transition-colors">
						<span class="w-2 h-2 rounded-full" style="background-color: {child.color || '#d97706'}"></span>
						<span class="font-medium text-stone-800">{child.name}</span>
						{#if child.nativeName}
							<span class="text-stone-400 text-xs italic">{child.nativeName}</span>
						{/if}
						{#if child.languageType !== 'language'}
							<span class="text-[10px] text-stone-400">({child.languageType})</span>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Dialects -->
	{#if data.dialects.length > 0}
		<div class="bg-white rounded-lg border border-stone-200 p-4">
			<h3 class="text-sm font-semibold text-stone-800 mb-2">Dialects</h3>
			<div class="space-y-1">
				{#each data.dialects as dialect}
					<div class="flex items-center gap-2 text-sm">
						<span class="font-medium text-stone-700">{dialect.name}</span>
						{#if dialect.region}
							<span class="text-stone-400 text-xs">({dialect.region})</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

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
						<WordEntry {entry} showLanguage={false} />
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
