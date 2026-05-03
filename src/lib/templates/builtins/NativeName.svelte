<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg, namedArg } from '../args.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { args }: { args: TemplateArg[] } = $props()

	const langCode = (positionalArg(args, 0) ?? '').trim()
	const text = (positionalArg(args, 1) ?? '').trim()
	const italics = namedArg(args, 'italics')?.toLowerCase().trim() !== 'no'
</script>

{#if text}
	<span lang={langCode || undefined} class:italic={italics}>
		<InlineMarkup text={text} />
	</span>
{/if}
