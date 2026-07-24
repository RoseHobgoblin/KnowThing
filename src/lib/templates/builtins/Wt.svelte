<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'

	let { args }: { args: TemplateArg[] } = $props()
	const ctx = getKnowContext()

	const word = $derived(positionalArg(args, 0)?.trim() || '')
	const lang = $derived(positionalArg(args, 1)?.trim() || '')

	// Same resolved-links contract as WikiWordbookLink: absent ⇒ red link.
	const key = $derived(`wordbook:${lang.toLowerCase()}/${word.toLowerCase()}`)
	const resolved = $derived(ctx.resolvedLinks?.get(key))
	const exists = $derived(resolved?.exists ?? false)
	const href = $derived(resolved?.href
		?? `/Wordbook/${encodeURIComponent(lang.toLowerCase())}/${encodeURIComponent(word)}`)
</script>

{#if word && lang}
	<a
		{href}
		class="
			italic border-b border-dotted transition-colors
			{exists
				? 'text-link border-accent-border hover:text-link-hover hover:border-accent-hover'
				: 'text-link-missing border-error-border hover:border-error'}
		"
		title="{word} ({lang}){exists ? '' : ' — not yet in the wordbook'}"
	>{word}</a>
{:else if word}
	<span class="italic text-secondary">{word}</span>
{/if}
