<script lang="ts">
	import { parseInline } from '$lib/parser/inline.js';
	import WikiNode from './WikiNode.svelte';
	import type { WikiNode as WikiNodeType } from '$lib/parser/types.js';

	let { text }: { text: string } = $props();

	// Parse inline wikitext (links, bold, italic, <br>, etc.) into AST nodes
	function parseText(raw: string): WikiNodeType {
		const children = parseInline(raw);
		return { type: 'document', children };
	}

	const ast = $derived(parseText(text));
</script>

{#if text}
	<WikiNode node={ast} />
{/if}
