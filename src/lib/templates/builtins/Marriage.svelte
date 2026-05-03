<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg, namedArg } from '../args.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { args }: { args: TemplateArg[] } = $props()

	const spouse = (positionalArg(args, 0) ?? '').trim()
	const startYear = (positionalArg(args, 1) ?? '').trim()
	const endYear = ((namedArg(args, 'end') ?? positionalArg(args, 2)) ?? '').trim()
	const reason = (namedArg(args, 'reason') ?? 'div.').trim()
</script>

{#if spouse}<InlineMarkup text={spouse} />{/if}{#if startYear}&nbsp;<span class="text-dim">({#if endYear}m. {startYear}; {reason} {endYear}{:else}m. {startYear}{/if})</span>{/if}
