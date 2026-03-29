<script lang="ts">
	import { getKnowContext } from '../context.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	const ctx = getKnowContext()
	let footnotes = $derived.by(() => {
		let value: { index: number, content: import('$lib/parser/types.js').WikiNode[] }[] = []
		ctx.footnotes.subscribe(v => (value = v))()
		return value
	})
</script>

{#if footnotes.length > 0}
	<div class="know-references mt-6 pt-4 border-t border-border-strong">
		<ol class="list-decimal pl-8 text-sm">
			{#each footnotes as function_}
				<li id="cite-note-{function_.index}" class="mb-1">
					{#each function_.content as child}<WikiNodeComponent node={child} />{/each}
				</li>
			{/each}
		</ol>
	</div>
{/if}
