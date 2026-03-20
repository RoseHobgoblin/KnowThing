<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { content }: { content: WikiNode[] } = $props()
</script>

<div class="know-hatnote italic text-sm text-secondary mb-4 pl-4 border-l-2 border-border-strong">
	{#each content as child}<WikiNodeComponent node={child} />{/each}
</div>
