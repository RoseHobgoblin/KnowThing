<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	let { children }: { children: WikiNode[] } = $props();
</script>

<sup>{#each children as child}<WikiNodeComponent node={child} />{/each}</sup>
