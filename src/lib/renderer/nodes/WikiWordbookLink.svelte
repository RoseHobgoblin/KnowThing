<script lang="ts">
	import type { WordbookLinkNode } from '$lib/parser/types.js'
	import WikiNode from '../WikiNode.svelte'

	let { node }: { node: WordbookLinkNode } = $props()

	// Empty word → language-level link [[Wordbook/Lang]]; otherwise word link.
	// Canonical URL is TitleCase /Wordbook/...; the `reroute` hook in
	// `src/hooks.ts` rewrites incoming requests to the lowercase route tree.
	const href = $derived.by(() => node.word
		? `/Wordbook/${encodeURIComponent(node.language)}/${encodeURIComponent(node.word)}`
		: `/Wordbook/${encodeURIComponent(node.language)}`)
	const titleAttribute = $derived(node.word
		? `Wordbook: ${node.word} (${node.language})`
		: `Wordbook: ${node.language}`)
	const fallbackText = $derived(node.word || node.language)
</script>

<a {href} class="text-link hover:text-link-hover underline decoration-transparent hover:decoration-current transition-colors" title={titleAttribute}>
	{#if node.display}
		{#each node.display as child}
			<WikiNode node={child} />
		{/each}
	{:else}
		{fallbackText}
	{/if}
</a>
