<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { children }: { children: WikiNode[] } = $props()
</script>

<b>{#each children as child, index (index)}<WikiNodeComponent node={child} />{/each}</b>
