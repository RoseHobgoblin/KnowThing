<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { level, children }: { level: number, children: WikiNode[] } = $props()

	// Generate an anchor ID from text content
	function getAnchorId(nodes: WikiNode[]): string {
		return extractText(nodes)
			.replaceAll(/\s+/g, '_')
			.replaceAll(/[^\w\-]/g, '')
	}

	function extractText(nodes: WikiNode[]): string {
		return nodes
			.map((n) => {
				if (n.type === 'text') return n.text
				if ('children' in n && Array.isArray(n.children)) return extractText(n.children)
				if ('content' in n && Array.isArray(n.content)) return extractText(n.content)
				if (n.type === 'internal_link') return n.display ? extractText(n.display) : n.target
				return ''
			})
			.join('')
	}

	const id = $derived(getAnchorId(children))
</script>

{#if level === 2}
	<h2 {id} class="know-heading text-2xl font-bold mt-6 mb-2 pb-1 border-b border-border-strong">
		{#each children as child}<WikiNodeComponent node={child} />{/each}
	</h2>
{:else if level === 3}
	<h3 {id} class="know-heading text-xl font-bold mt-5 mb-2">
		{#each children as child}<WikiNodeComponent node={child} />{/each}
	</h3>
{:else if level === 4}
	<h4 {id} class="know-heading text-lg font-bold mt-4 mb-1">
		{#each children as child}<WikiNodeComponent node={child} />{/each}
	</h4>
{:else if level === 5}
	<h5 {id} class="know-heading text-base font-bold mt-3 mb-1">
		{#each children as child}<WikiNodeComponent node={child} />{/each}
	</h5>
{:else}
	<h6 {id} class="know-heading text-sm font-bold mt-3 mb-1">
		{#each children as child}<WikiNodeComponent node={child} />{/each}
	</h6>
{/if}
