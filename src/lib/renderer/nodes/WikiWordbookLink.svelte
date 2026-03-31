<script lang="ts">
	import type { WordbookLinkNode, WikiNode as WikiNodeType } from '$lib/parser/types.js'
	import WikiNode from '../WikiNode.svelte'

	let { node }: { node: WordbookLinkNode } = $props()

	const href = $derived.by(() => `/wordbook/${encodeURIComponent(node.language)}/${encodeURIComponent(node.word)}`)
</script>

<a {href} class="text-link hover:text-link-hover underline decoration-transparent hover:decoration-current transition-colors" title="Wordbook: {node.word} ({node.language})">
	{#if node.display}
		{#each node.display as child}
			<WikiNode node={child} />
		{/each}
	{:else}
		{node.word}
	{/if}
</a>
