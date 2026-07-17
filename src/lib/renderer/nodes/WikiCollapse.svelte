<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { title, content }: { title: string, content: WikiNode[] } = $props()
</script>

<details class="know-collapse my-2">
	<summary class="bg-raised px-3 py-2 cursor-pointer font-semibold text-sm">{title}</summary>
	<div class="px-3 py-2">
		{#each content as child}<WikiNodeComponent node={child} />{/each}
	</div>
</details>
