<script lang="ts">
	import type { ListItem } from '$lib/parser/types.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	let { items }: { items: ListItem[] } = $props();
</script>

<ul class="know-ul list-disc pl-8 my-2">
	{#each items as item}
		<li>
			{#each item.children as child}<WikiNodeComponent node={child} />{/each}
		</li>
	{/each}
</ul>
