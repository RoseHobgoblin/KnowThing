<script lang="ts">
	import type { DomainLinkNode } from '$lib/parser/types.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { node }: { node: DomainLinkNode } = $props()

	const ctx = getKnowContext()

	// Build the href; for domains with parent_path structure,
	// we'd need a lookup. For now, use /{domain}/{target}
	const href = $derived.by(() => `/${node.domain}/${encodeURIComponent(node.target)}`)

	// Check existence for red-link detection
	const exists = $derived.by(() => ctx.existingContent?.get(node.domain)?.has(node.target.toLowerCase()) ?? false)
</script>

<a
	{href}
	class="{exists ? 'text-link hover:text-link-hover' : 'text-link-missing'} underline decoration-transparent hover:decoration-current transition-colors"
	title="{node.domain}: {node.target}"
>{#if node.display}{#each node.display as child}<WikiNodeComponent node={child} />{/each}{:else}{node.target}{/if}</a>
