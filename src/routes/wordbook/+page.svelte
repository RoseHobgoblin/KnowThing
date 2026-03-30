<script lang="ts">
	import type { PageData } from './$types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import WordbookSearch from '$lib/components/wordbook/WordbookSearch.svelte'
	import LanguageCard from '$lib/components/wordbook/LanguageCard.svelte'
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={[{ label: 'Wordbook' }]}
	title="Wordbook"
>
	<p class="text-dim mb-4">
		{data.totalWords} {data.totalWords === 1 ? 'word' : 'words'} across {data.languages.length} {data.languages.length === 1 ? 'language' : 'languages'}
	</p>

	<div class="max-w-2xl mb-4">
		<WordbookSearch languages={data.languages} large />
	</div>

	<div class="mb-6">
		<a href="/wordbook/contribute" class="text-sm text-link hover:text-link-hover hover:underline">+ Add word</a>
	</div>

	<!-- Languages -->
	{#if data.languages.length > 0}
		<section class="mb-6">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-lg font-semibold text-body">Languages</h2>
				<a href="/wordbook/contribute/language" class="text-sm text-link hover:text-link-hover hover:underline">+ Add language</a>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.languages as lang}
					<LanguageCard
						name={lang.name}
						slug={lang.slug}
						nativeName={lang.nativeName}
						family={lang.family}
						script={lang.script}
						color={lang.color || 'var(--color-accent)'}
						wordCount={Number(lang.wordCount)}
					/>
				{/each}
			</div>
		</section>
	{:else}
		<div class="text-center py-12 text-faint">
			<p class="text-lg mb-2">No languages yet</p>
			<p class="text-sm">
				<a href="/wordbook/contribute/language" class="text-link hover:underline">Add a language</a> to get started.
			</p>
		</div>
	{/if}

	<!-- Recent -->
	{#if data.recent.length > 0}
		<section>
			<h2 class="text-lg font-semibold text-body mb-3">Recently Added</h2>
			<div class="bg-raised border border-border-subtle divide-y divide-border-subtle">
				{#each data.recent as entry}
					<WordEntry {entry} />
				{/each}
			</div>
		</section>
	{/if}
</ArticleShell>
