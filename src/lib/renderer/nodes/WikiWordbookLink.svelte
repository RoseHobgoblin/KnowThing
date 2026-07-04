<script lang="ts">
	import type { WordbookLinkNode } from '$lib/parser/types.js'
	import WikiNode from '../WikiNode.svelte'
	import { getKnowContext } from '../context.js'

	let { node }: { node: WordbookLinkNode } = $props()

	const ctx = getKnowContext()

	// Existence comes from ctx.resolvedLinks, keyed `wordbook:<lang>` for a
	// language link or `wordbook:<lang>/<word>` for a word link (lowercase,
	// matching resolveWordbookFallthrough). Absent ⇒ red link, same semantics
	// as WikiNamespaceLink.
	const key = $derived(node.word
		? `wordbook:${node.language}/${node.word.toLowerCase()}`
		: `wordbook:${node.language}`)
	const resolved = $derived(ctx.resolvedLinks?.get(key))
	const exists = $derived(resolved?.exists ?? false)

	// Prefer the resolver's canonical href (correct casing); fall back to the
	// literal path. Canonical URL is TitleCase /Wordbook/...; the `reroute`
	// hook in `src/hooks.ts` rewrites incoming requests to the lowercase tree.
	const href = $derived.by(() => {
		if (resolved?.href) return resolved.href
		return node.word
			? `/Wordbook/${encodeURIComponent(node.language)}/${encodeURIComponent(node.word)}`
			: `/Wordbook/${encodeURIComponent(node.language)}`
	})
	const titleAttribute = $derived.by(() => {
		const base = node.word
			? `Wordbook: ${node.word} (${node.language})`
			: `Wordbook: ${node.language}`
		return exists ? base : `${base} (not yet in the wordbook)`
	})
	const fallbackText = $derived(node.word || node.language)
</script>

<a
	{href}
	class="{exists ? 'text-link hover:text-link-hover' : 'text-link-missing'} underline decoration-transparent hover:decoration-current transition-colors"
	title={titleAttribute}
>
	{#if node.display}
		{#each node.display as child}
			<WikiNode node={child} />
		{/each}
	{:else}
		{fallbackText}
	{/if}
</a>
