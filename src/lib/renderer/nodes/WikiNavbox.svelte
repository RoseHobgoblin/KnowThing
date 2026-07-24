<script lang="ts">
	import type { NavboxGroup } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { title, groups }: { title: string, groups: NavboxGroup[] } = $props()
</script>

<nav class="know-navbox my-4 text-sm">
	<div class="bg-border px-3 py-1.5 font-bold text-center">{title}</div>
	{#each groups as group, groupIndex (groupIndex)}
		<div class="flex border-t border-border-strong">
			<div class="bg-raised px-3 py-1 font-semibold min-w-30 border-r border-border-strong">
				{group.name}
			</div>
			<div class="px-3 py-1 flex-1">
				{#each group.items as item, index (index)}
					{#if index > 0}<span class="mx-1 text-secondary">·</span>{/if}
					<WikiNodeComponent node={item} />
				{/each}
			</div>
		</div>
	{/each}
</nav>
