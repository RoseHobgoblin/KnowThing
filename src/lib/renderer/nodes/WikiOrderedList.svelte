<script lang="ts">
	import type { ListItem } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { items }: { items: ListItem[] } = $props()
</script>

<ol class="know-ol list-decimal pl-8 my-2">
	{#each items as item, index (index)}
		<li>
			{#each item.children as child, childIndex (childIndex)}<WikiNodeComponent node={child} />{/each}
		</li>
	{/each}
</ol>
