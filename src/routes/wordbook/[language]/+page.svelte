<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import AlphabetNav from '$lib/components/wordbook/AlphabetNav.svelte'
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte'
	import DimensionEditor from '$lib/components/wordbook/DimensionEditor.svelte'
	import PhonemeEditor from '$lib/components/wordbook/PhonemeEditor.svelte'

	let { data }: { data: PageData } = $props()

	const layoutData = $derived($page.data)
	const isAuthenticated = $derived(!!layoutData.user)

	// Group entries by first letter
	function groupByLetter(entries: typeof data.entries) {
		const groups: Record<string, typeof entries> = {}
		for (const entry of entries) {
			const letter = entry.word[0].toUpperCase()
			if (!groups[letter]) groups[letter] = []
			groups[letter].push(entry)
		}
		return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
	}

	const grouped = $derived(groupByLetter(data.entries))
</script>

<svelte:head>
	<title>{data.language.name} — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Ancestry breadcrumb -->
	{#if data.ancestryChain.length > 1}
		<nav class="flex items-center gap-1 text-sm text-dim flex-wrap">
			{#each data.ancestryChain as ancestor, index}
				{#if index > 0}<span class="text-faint">›</span>{/if}
				{#if ancestor.id === data.language.id}
					<span class="text-secondary font-medium">{ancestor.name}</span>
				{:else}
					<a href="/wordbook/{ancestor.slug}" class="hover:text-link">{ancestor.name}</a>
				{/if}
			{/each}
		</nav>
	{/if}

	<!-- Language header -->
	<div>
		<div class="flex items-start justify-between mb-1">
			<div class="flex items-baseline gap-3">
				<h1 class="text-3xl font-bold text-heading">{data.language.name}</h1>
				{#if data.language.nativeName}
					<span class="text-lg text-faint italic">{data.language.nativeName}</span>
				{/if}
			</div>
			<div class="flex gap-3 shrink-0">
				<a href="/wordbook/contribute?language={data.language.slug}" class="text-sm text-link hover:text-link-hover hover:underline">+ Add word</a>
				<a href="/wordbook/contribute/language/{data.language.slug}" class="text-sm text-faint hover:text-link hover:underline">Edit language</a>
			</div>
		</div>

		<div class="flex items-center gap-3 text-sm text-dim mb-3">
			{#if data.language.family}
				<span>{data.language.family} family</span>
			{/if}
			{#if data.language.script}
				<span class="text-faint">·</span>
				<span>{data.language.script} script</span>
			{/if}
			<span class="text-faint">·</span>
			<span style="color: {data.language.color};" class="font-medium">{Number(data.language.wordCount)} words</span>
		</div>

		{#if data.language.description}
			<p class="text-secondary leading-relaxed">{data.language.description}</p>
		{/if}

		{#if data.language.pageSlug}
			<a href="/know/{data.language.pageSlug}" class="inline-block mt-2 text-sm text-link hover:text-link-hover hover:underline">
				Read the full article →
			</a>
		{/if}
	</div>

	<!-- Child languages -->
	{#if data.children.length > 0}
		<div class="bg-surface rounded-lg border border-border p-4">
			<h3 class="text-sm font-semibold text-body mb-2">Descendant languages</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.children as child}
					<a href="/wordbook/{child.slug}" class="
						inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm
						transition-colors
						hover:border-accent-border hover:bg-accent-subtle
					">
						<span class="size-2 rounded-full" style="background-color: {child.color || '#d97706'}"></span>
						<span class="font-medium text-body">{child.name}</span>
						{#if child.nativeName}
							<span class="text-faint text-xs italic">{child.nativeName}</span>
						{/if}
						{#if child.languageType !== 'language'}
							<span class="text-[10px] text-faint">({child.languageType})</span>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Dialects -->
	{#if data.dialects.length > 0}
		<div class="bg-surface rounded-lg border border-border p-4">
			<h3 class="text-sm font-semibold text-body mb-2">Dialects</h3>
			<div class="space-y-1">
				{#each data.dialects as dialect}
					<div class="flex items-center gap-2 text-sm">
						<span class="font-medium text-secondary">{dialect.name}</span>
						{#if dialect.region}
							<span class="text-faint text-xs">({dialect.region})</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Phoneme inventory -->
	{#if data.phonemes.length > 0 || isAuthenticated}
		<PhonemeEditor
			languageSlug={data.language.slug}
			phonemes={data.phonemes}
		/>
	{/if}

	<!-- Inflection system (editor+ only) -->
	{#if data.inflectionDimensions.length > 0 || isAuthenticated}
		<DimensionEditor
			languageSlug={data.language.slug}
			dimensions={data.inflectionDimensions}
			classes={data.paradigmClasses}
		/>
	{/if}

	<!-- Alphabet nav -->
	<div class="border-y border-border bg-surface px-2">
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
				<h2 class="text-xl font-bold text-faint mb-2 pl-1" id="letter-{letter}">{letter}</h2>
				<div class="bg-surface rounded-lg border border-border divide-y divide-border-subtle">
					{#each entries as entry}
						<WordEntry {entry} showLanguage={false} />
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<div class="text-center py-12 text-faint">
			{#if data.currentLetter}
				<p>No words starting with "{data.currentLetter.toUpperCase()}"</p>
			{:else}
				<p class="text-lg mb-2">No words yet</p>
				<p class="text-sm">
					<a href="/wordbook/contribute?language={data.language.slug}" class="text-link hover:underline">Add the first word</a>
				</p>
			{/if}
		</div>
	{/if}
</div>
