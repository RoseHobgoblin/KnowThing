<script lang="ts">
	import type { DefinitionItem } from '$lib/parser/types.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	let { items }: { items: DefinitionItem[] } = $props();
</script>

<dl class="know-dl my-2">
	{#each items as item}
		<dt class="font-bold">
			{#each item.term as child}<WikiNodeComponent node={child} />{/each}
		</dt>
		{#if item.definition.length > 0}
			<dd class="pl-6">
				{#each item.definition as child}<WikiNodeComponent node={child} />{/each}
			</dd>
		{/if}
	{/each}
</dl>
