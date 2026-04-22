<script lang="ts">
	import { getKnowContext } from '$lib/renderer/context.js'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { get } from 'svelte/store'

	const ctx = getKnowContext()
	const footnotes = $derived(get(ctx.footnotes))
</script>

{#if footnotes.length > 0}
	<div class="know-notelist mt-6 pt-4 border-t border-border-strong">
		<div class="font-medium text-secondary mb-2">Notes</div>
		<ol class="list-decimal pl-8 text-sm">
			{#each footnotes as footnote (footnote.index)}
				<li id="cite-note-{footnote.index}" class="mb-1">
					{#each footnote.content as child, i (i)}<WikiNodeComponent node={child} />{/each}
				</li>
			{/each}
		</ol>
	</div>
{/if}
