<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const word = positionalArg(args, 0)?.trim() || ''
	const lang = positionalArg(args, 1)?.trim() || ''
</script>

{#if word && lang}
	<a
		href="/Wordbook/{encodeURIComponent(lang.toLowerCase())}/{encodeURIComponent(word)}"
		class="
			italic text-link border-b border-dotted border-accent-border transition-colors
			hover:text-link-hover hover:border-accent-hover
		"
		title="{word} ({lang})"
	>{word}</a>
{:else if word}
	<span class="italic text-secondary">{word}</span>
{/if}
