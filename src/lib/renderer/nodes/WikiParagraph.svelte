<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { children }: { children: WikiNode[] } = $props()
</script>

<p class="know-paragraph my-2 leading-relaxed">
	{#each children as child}<WikiNodeComponent node={child} />{/each}
</p>
