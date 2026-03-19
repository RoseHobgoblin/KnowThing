<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js';

	let { ast }: { ast: WikiNode } = $props();

	interface TocEntry {
		level: number;
		text: string;
		id: string;
	}

	function extractHeadings(node: WikiNode): TocEntry[] {
		const entries: TocEntry[] = [];
		if (node.type === 'document') {
			for (const child of node.children) {
				if (child.type === 'heading') {
					const text = extractText(child.children);
					const id = text.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
					entries.push({ level: child.level, text, id });
				}
			}
		}
		return entries;
	}

	function extractText(nodes: WikiNode[]): string {
		return nodes
			.map((n) => {
				if (n.type === 'text') return n.text;
				if ('children' in n && Array.isArray(n.children)) return extractText(n.children);
				if (n.type === 'internal_link') return n.display ? extractText(n.display) : n.target;
				return '';
			})
			.join('');
	}

	const headings = $derived(extractHeadings(ast));
	const show = $derived(headings.length >= 3);
</script>

{#if show}
	<details open class="border-l-4 border-amber-400 bg-white rounded-lg shadow-sm mb-6 overflow-hidden w-fit max-w-xs">
		<summary class="px-4 py-2.5 font-semibold text-stone-800 text-sm cursor-pointer hover:bg-amber-50/50 select-none transition-colors">
			Sections
		</summary>
		<nav class="px-4 pb-3 pt-1">
			<ol class="list-decimal pl-5 space-y-0.5 text-sm">
				{#each headings as h}
					<li style="margin-left: {(h.level - 2) * 16}px">
						<a href="#{h.id}" class="text-stone-600 hover:text-amber-700 transition-colors">{h.text}</a>
					</li>
				{/each}
			</ol>
		</nav>
	</details>
{/if}
