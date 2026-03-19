<script lang="ts">
	import { getWikiContext } from '../context.js';
	import WikiNodeComponent from '../WikiNode.svelte';

	const ctx = getWikiContext();
	let footnotes = $derived.by(() => {
		let value: { index: number; content: import('$lib/parser/types.js').WikiNode[] }[] = [];
		ctx.footnotes.subscribe((v) => (value = v))();
		return value;
	});
</script>

{#if footnotes.length > 0}
	<div class="know-references mt-6 pt-4 border-t border-stone-300">
		<ol class="list-decimal pl-8 text-sm">
			{#each footnotes as fn}
				<li id="cite-note-{fn.index}" class="mb-1">
					{#each fn.content as child}<WikiNodeComponent node={child} />{/each}
				</li>
			{/each}
		</ol>
	</div>
{/if}
