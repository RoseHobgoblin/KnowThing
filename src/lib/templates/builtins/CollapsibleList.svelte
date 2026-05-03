<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, namedArgAny, positionalArgs } from '../args.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { args }: { args: TemplateArg[] } = $props()

	const summary = (namedArgAny(args, 'title', 'titlestyle') ?? 'See list').trim()

	function collectItems(): string[] {
		const numbered: string[] = []
		for (let i = 1; i < 50; i++) {
			const v = namedArg(args, String(i))
			if (v === undefined) break
			numbered.push(v)
		}
		if (numbered.length > 0) return numbered.map(s => s.trim()).filter(Boolean)
		return positionalArgs(args).map(s => s.trim()).filter(Boolean)
	}

	const items = collectItems()
</script>

{#if items.length > 0}
	<details class="cl-details">
		<summary class="cl-summary"><InlineMarkup text={summary} /></summary>
		<div class="cl-body">
			{#each items as item}
				<div><InlineMarkup text={item} /></div>
			{/each}
		</div>
	</details>
{/if}
