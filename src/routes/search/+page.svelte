<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity'
	import type { PageData } from './$types.js'
	import SearchForm from '$lib/feature/search/public/ui/SearchForm.svelte'
	import SearchScopeTabs from '$lib/feature/search/public/ui/SearchScopeTabs.svelte'
	import SearchFilters from '$lib/feature/search/public/ui/SearchFilters.svelte'
	import SearchFilterChips from '$lib/feature/search/public/ui/SearchFilterChips.svelte'
	import SearchResults from '$lib/feature/search/public/ui/SearchResults.svelte'
	import SearchEmptyState from '$lib/feature/search/public/ui/SearchEmptyState.svelte'
	import SearchPagination from '$lib/feature/search/public/ui/SearchPagination.svelte'

	let { data }: { data: PageData } = $props()

	type SearchScope = 'all' | 'pages' | 'wordbook' | 'media'

	const scopes: Array<{ value: SearchScope, label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'pages', label: 'Pages' },
		{ value: 'wordbook', label: 'Wordbook' },
		{ value: 'media', label: 'Media' },
	]

	function scopeHref(scope: SearchScope) {
		return buildHref('/search', scope)
	}

	function scopeCount(scope: SearchScope): number {
		if (scope === 'all') return data.pagination.totalResults
		if (scope === 'pages') return data.countsByScope.pages
		if (scope === 'wordbook') return data.countsByScope.wordbook
		return data.countsByScope.media
	}

	function buildHref(basePath: string, scope: SearchScope, page = 1) {
		const params = new SvelteURLSearchParams()
		if (data.query.q) params.set('q', data.query.q)
		params.set('scope', scope)
		params.set('page', String(page))
		if (data.query.filters.language) params.set('language', data.query.filters.language)
		if (data.query.filters.tag) params.set('tag', data.query.filters.tag)
		if (data.query.filters.pos) params.set('pos', data.query.filters.pos)
		if (data.query.filters.mediaCategory) params.set('mediaCategory', data.query.filters.mediaCategory)
		if (data.query.filters.unused) params.set('unused', 'true')
		return `${basePath}?${params.toString()}`
	}
</script>

<svelte:head>
	<title>{data.query.q ? `Search: ${data.query.q}` : 'Search'} - KnowThing</title>
</svelte:head>

<div class="space-y-5">
	<div>
		<h1 class="text-2xl font-bold mb-2">
			{#if data.query.q}
				Search results for "{data.query.q}"
			{:else}
				Search
			{/if}
		</h1>
		<p class="text-sm text-secondary">Unified search across pages, wordbook entries, and media.</p>
	</div>

	<SearchForm
		action="/search"
		query={data.query.q}
		scope={data.query.scope}
		hiddenFields={{
			language: data.query.filters.language,
			tag: data.query.filters.tag,
			pos: data.query.filters.pos,
			mediaCategory: data.query.filters.mediaCategory,
			unused: data.query.filters.unused ? 'true' : undefined,
		}}
	/>

	<SearchScopeTabs
		currentScope={data.query.scope}
		scopes={scopes.map(scope => ({
			value: scope.value,
			label: scope.label,
			href: scopeHref(scope.value),
			count: scopeCount(scope.value),
		}))}
	/>

	<SearchFilters
		action="/search"
		query={data.query.q}
		scope={data.query.scope}
		language={data.query.filters.language ?? ''}
		tag={data.query.filters.tag ?? ''}
		pos={data.query.filters.pos ?? ''}
		mediaCategory={data.query.filters.mediaCategory ?? ''}
		unused={data.query.filters.unused ?? false}
		languages={data.filterOptions.languages}
		partsOfSpeech={data.filterOptions.partsOfSpeech}
		mediaCategories={data.filterOptions.mediaCategories}
		clearHref="/search"
	/>

	<SearchFilterChips
		query={data.query.q}
		language={data.query.filters.language}
		tag={data.query.filters.tag}
		pos={data.query.filters.pos}
		mediaCategory={data.query.filters.mediaCategory}
		unused={data.query.filters.unused}
		clearHref="/search"
	/>

	{#if !data.query.q}
		<SearchEmptyState idleMessage="Enter a search term to search pages, wordbook entries, and media." />
	{:else if data.results.length === 0}
		<SearchEmptyState query={data.query.q} noResultsMessage={`No results found for "${data.query.q}".`} />
	{:else}
		<div class="text-sm text-dim">{data.pagination.totalResults} result{data.pagination.totalResults === 1 ? '' : 's'}</div>
		<SearchResults results={data.results} />
		<SearchPagination
			page={data.pagination.page}
			totalPages={data.pagination.totalPages}
			totalResults={data.pagination.totalResults}
			hasPreviousPage={data.pagination.hasPreviousPage}
			hasNextPage={data.pagination.hasNextPage}
			prevHref={buildHref('/search', data.query.scope, data.pagination.page - 1)}
			nextHref={buildHref('/search', data.query.scope, data.pagination.page + 1)}
		/>
	{/if}
</div>
