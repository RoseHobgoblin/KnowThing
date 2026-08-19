<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { children }: { children: WikiNode[] } = $props()

	type ParagraphSegment =
		| { kind: 'inline', children: WikiNode[] }
		| { kind: 'block', child: WikiNode }

	function isBlockTemplate(node: WikiNode): boolean {
		return node.type === 'template'
			&& ['root map', 'sector map'].includes(node.name.trim().toLowerCase())
	}

	const segments = $derived.by(() => {
		const result: ParagraphSegment[] = []
		let inline: WikiNode[] = []
		const flushInline = () => {
			if (inline.length > 0) result.push({ kind: 'inline', children: inline })
			inline = []
		}
		for (const child of children) {
			if (isBlockTemplate(child)) {
				flushInline()
				result.push({ kind: 'block', child })
			} else {
				inline.push(child)
			}
		}
		flushInline()
		return result
	})
</script>

{#each segments as segment, segmentIndex (segmentIndex)}
	{#if segment.kind === 'block'}
		<WikiNodeComponent node={segment.child} />
	{:else}
		<p class="know-paragraph my-2 leading-relaxed">
			{#each segment.children as child, childIndex (childIndex)}<WikiNodeComponent node={child} />{/each}
		</p>
	{/if}
{/each}
