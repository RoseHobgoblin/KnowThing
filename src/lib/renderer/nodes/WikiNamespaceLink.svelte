<script lang="ts">
	import type { NamespaceLinkNode } from '$lib/parser/types.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { node }: { node: NamespaceLinkNode } = $props()

	const ctx = getKnowContext()

	// Cache key matches what content-effects.ts writes: `targetDomain` is the
	// lowercased namespace key, `targetSlug` is the verbatim identifier. The
	// resolver populates `ctx.resolvedLinks` server-side.
	const resolved = $derived.by(() => {
		const domainKey = node.namespace.toLowerCase()
		const link = ctx.resolvedLinks.get(`${domainKey}:${node.identifier.toLowerCase()}`)
		if (link) return link
		// Fallback: deterministic canonical /<Namespace>:<Identifier> URL.
		return { href: `/${node.namespace}:${encodeURIComponent(node.identifier)}`, exists: false }
	})

	const href = $derived(resolved.href)
	const exists = $derived(resolved.exists)
</script>

<a
	{href}
	class="{exists ? 'text-link hover:text-link-hover' : 'text-link-missing'} underline decoration-transparent transition-colors hover:decoration-current"
	title="{node.namespace}:{node.identifier}"
>{#if node.display}{#each node.display as child, index (index)}<WikiNodeComponent node={child} />{/each}{:else}{node.identifier}{/if}</a>
