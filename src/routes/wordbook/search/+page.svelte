<script lang="ts">
	import type { PageData } from './$types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import WordbookSearch from '$lib/components/wordbook/WordbookSearch.svelte'
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte'
	import TagPill from '$lib/components/wordbook/TagPill.svelte'
	import { wordbookSearchBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')
</script>

<svelte:head>
	<title>{data.query ? `"${data.query}" — ` : ''}{wbName} Search — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookSearchBreadcrumbs(wbName)}
	title="Search the {wbName}"
>
	<div class="mb-4">
		<WordbookSearch languages={data.languages} />
	</div>

	{#if data.query || data.tag || data.language || data.pos}
		<div class="flex items-center gap-2 flex-wrap text-sm mb-4">
			<span class="text-dim">Filters:</span>
			{#if data.query}
				<span class="px-2 py-0.5 bg-accent-subtle text-link border border-accent-border">"{data.query}"</span>
			{/if}
			{#if data.language}
				<span class="px-2 py-0.5 bg-raised text-secondary border border-border">{data.language}</span>
			{/if}
			{#if data.tag}
				<TagPill tag={data.tag} />
			{/if}
			{#if data.pos}
				<span class="px-2 py-0.5 bg-raised text-secondary border border-border">{data.pos}</span>
			{/if}
			<a href="/wordbook/search" class="text-xs text-faint hover:text-secondary">Clear all</a>
		</div>

		{#if data.results.length > 0}
			<div class="text-sm text-dim mb-2">{data.results.length} result{data.results.length === 1 ? '' : 's'}</div>
			<div class="bg-raised border border-border-subtle divide-y divide-border-subtle">
				{#each data.results as entry}
					<WordEntry {entry} />
				{/each}
			</div>
		{:else}
			<div class="text-center py-12 text-faint">
				<p class="text-lg">No results found</p>
				<p class="text-sm mt-1">Try a different search term or broader filters</p>
			</div>
		{/if}
	{:else}
		<div class="text-center py-12 text-faint">
			<p>Enter a search term or select filters to find words</p>
		</div>
	{/if}
</ArticleShell>
