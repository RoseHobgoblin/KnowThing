<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArgs } from '../args.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { args, variant }: { args: TemplateArg[], variant: 'unbulleted' | 'horizontal' | 'br-separated' } = $props()

	const items = $derived(positionalArgs(args).map(s => s.trim()).filter(Boolean))
</script>

{#if items.length > 0}
	{#if variant === 'unbulleted'}
		<ul class="ub-list">
			{#each items as item, index (index)}
				<li><InlineMarkup text={item} /></li>
			{/each}
		</ul>
	{:else if variant === 'horizontal'}
		<ul class="h-list">
			{#each items as item, index (index)}
				<li><InlineMarkup text={item} /></li>
			{/each}
		</ul>
	{:else if variant === 'br-separated'}
		<span>
			{#each items as item, i (i)}
				{#if i > 0}<br />{/if}
				<InlineMarkup text={item} />
			{/each}
		</span>
	{/if}
{/if}
