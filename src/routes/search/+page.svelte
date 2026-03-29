<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()

	function resultUrl(r: any): string {
		const domain = r.domain || 'know'
		if (domain === 'know') return `/know/${r.slug}`
		if (r.parentPath) return `/${domain}/${r.parentPath}/${r.slug}`
		return `/${domain}/${r.slug}`
	}

	function domainLabel(domain: string): string {
		switch (domain) {
			case 'know': return ''
			case 'wordbook': return 'Wordbook'
			case 'celestial': return 'Celestial'
			case 'calendar': return 'Calendar'
			default: return domain
		}
	}
</script>

<svelte:head>
	<title>Search: {data.query} - KnowThing</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-4">
	{#if data.query}
		Search results for "{data.query}"
	{:else}
		Search
	{/if}
</h1>

{#if data.results.length === 0 && data.query}
	<p class="text-secondary">No results found for "{data.query}".</p>
{:else}
	<div class="space-y-4">
		{#each data.results as r}
			<div>
				<div class="flex items-center gap-2">
					<a href={resultUrl(r)} class="text-lg text-link font-medium hover:underline">{r.title}</a>
					{#if domainLabel(r.domain)}
						<span class="text-[10px] px-1.5 py-0.5 bg-raised text-secondary uppercase tracking-wider">{domainLabel(r.domain)}</span>
					{/if}
				</div>
				{#if r.snippet}
					<p class="text-sm text-secondary mt-0.5">{@html r.snippet}</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
