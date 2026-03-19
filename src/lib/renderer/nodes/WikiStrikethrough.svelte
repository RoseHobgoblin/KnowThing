<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	let { children }: { children: WikiNode[] } = $props();
</script>

<s>{#each children as child}<WikiNodeComponent node={child} />{/each}</s>
