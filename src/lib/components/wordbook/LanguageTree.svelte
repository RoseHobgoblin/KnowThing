<script lang="ts">
	type TreeNode = {
		id: number;
		name: string;
		slug: string;
		nativeName: string | null;
		languageType: string;
		color: string | null;
		children: TreeNode[];
	};

	let { tree, currentSlug = '' }: { tree: any; currentSlug?: string } = $props();
</script>

{#snippet node(n: { id: number; name: string; slug: string; nativeName: string | null; languageType: string; color: string | null; children: any[] }, depth: number)}
	<div class="flex items-center gap-2 py-1 {depth > 0 ? 'ml-4 pl-3 border-l border-stone-200' : ''}">
		<span class="w-2 h-2 rounded-full shrink-0" style="background-color: {n.color || '#d97706'}"></span>
		<a
			href="/wordbook/{n.slug}"
			class="text-sm hover:text-amber-700 transition-colors {n.slug === currentSlug ? 'font-bold text-amber-700' : 'text-stone-700'}"
		>
			{n.name}
		</a>
		{#if n.nativeName}
			<span class="text-xs text-stone-400 italic">{n.nativeName}</span>
		{/if}
		{#if n.languageType !== 'language'}
			<span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{n.languageType}</span>
		{/if}
	</div>
	{#each n.children as child}
		{@render node(child, depth + 1)}
	{/each}
{/snippet}

{@render node(tree, 0)}
