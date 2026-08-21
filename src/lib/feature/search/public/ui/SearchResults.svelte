<script lang="ts">
	import { resolve } from '$app/paths'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { sanitizeSnippet } from '$lib/utils.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import type { UnifiedSearchResult } from '$lib/feature/search/public/search-contracts.js'

	let {
		results,
	}: {
		results: UnifiedSearchResult[]
	} = $props()
</script>

<div class="space-y-4">
	{#each results as result (result.href)}
		<div>
			<div class="flex items-center gap-2 flex-wrap">
				<a href={resolve(result.href as `/${string}`)} class="text-lg text-link font-medium hover:underline">{result.title}</a>
				<Badge>{result.badge}</Badge>
				{#each result.meta as item, index (index)}
					<span class="text-xs text-secondary">{item}</span>
				{/each}
			</div>
			{#if result.snippet}
				{#if result.kind === 'word'}
					<div class="text-sm text-secondary mt-0.5 line-clamp-3">
						<InlineMarkup text={result.snippet} />
					</div>
				{:else}
					<!-- Snippets are reduced to the allowlisted <mark> tag by sanitizeSnippet. -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<p class="text-sm text-secondary mt-0.5">{@html sanitizeSnippet(String(result.snippet))}</p>
				{/if}
			{/if}
		</div>
	{/each}
</div>
