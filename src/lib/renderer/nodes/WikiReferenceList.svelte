<script lang="ts">
	import { get } from 'svelte/store'
	import { getKnowContext } from '../context.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	const ctx = getKnowContext()
	const footnotes = $derived(get(ctx.footnotes))
</script>

{#if footnotes.length > 0}
	<div class="know-references mt-6 pt-4 border-t border-border-strong">
		<ol class="list-decimal pl-8 text-sm">
			{#each footnotes as footnote (footnote.index)}
				<li id="cite-note-{footnote.index}" class="mb-1">
					{#each footnote.content as child, childIndex (childIndex)}<WikiNodeComponent node={child} />{/each}
				</li>
			{/each}
		</ol>
	</div>
{/if}
