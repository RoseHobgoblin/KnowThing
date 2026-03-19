<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	let { content }: { content: WikiNode[] } = $props();
</script>

<div class="know-hatnote italic text-sm text-stone-600 mb-4 pl-4 border-l-2 border-stone-300">
	{#each content as child}<WikiNodeComponent node={child} />{/each}
</div>
