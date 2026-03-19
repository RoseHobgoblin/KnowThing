<script lang="ts">
	import type { NavboxGroup } from '$lib/parser/types.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	let { title, groups }: { title: string; groups: NavboxGroup[] } = $props();
</script>

<nav class="know-navbox border border-stone-300 my-4 text-sm">
	<div class="bg-stone-200 px-3 py-1.5 font-bold text-center">{title}</div>
	{#each groups as group}
		<div class="flex border-t border-stone-300">
			<div class="bg-stone-100 px-3 py-1 font-semibold min-w-[120px] border-r border-stone-300">
				{group.name}
			</div>
			<div class="px-3 py-1 flex-1">
				{#each group.items as item, i}
					{#if i > 0}<span class="mx-1 text-stone-400">·</span>{/if}
					<WikiNodeComponent node={item} />
				{/each}
			</div>
		</div>
	{/each}
</nav>
