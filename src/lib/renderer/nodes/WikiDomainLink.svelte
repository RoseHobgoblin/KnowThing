<script lang="ts">
	import type { DomainLinkNode } from '$lib/parser/types.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { node }: { node: DomainLinkNode } = $props()

	const ctx = getKnowContext()

	const resolved = $derived.by(() => {
		const key = `${node.domain}:${node.target.toLowerCase()}`
		const link = ctx.resolvedLinks.get(key)
		if (link) return link
		// Not in resolved map — deterministic href, assume missing
		return { href: `/${node.domain}/${encodeURIComponent(node.target)}`, exists: false }
	})

	const href = $derived(resolved.href)
	const exists = $derived(resolved.exists)
</script>

<a
	{href}
	class="{exists ? 'text-link hover:text-link-hover' : 'text-link-missing'} underline decoration-transparent transition-colors hover:decoration-current"
	title="{node.domain}: {node.target}"
>{#if node.display}{#each node.display as child, index (index)}<WikiNodeComponent node={child} />{/each}{:else}{node.target}{/if}</a>
