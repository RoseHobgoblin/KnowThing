<script lang="ts">
	type TreeNode = {
		id: number
		name: string
		slug: string
		nativeName: string | null
		languageType: string
		color: string | null
		children: TreeNode[]
	}

	let { tree, currentSlug = '' }: { tree: any, currentSlug?: string } = $props()
</script>

{#snippet node(n: { id: number, name: string, slug: string, nativeName: string | null, languageType: string, color: string | null, children: any[] }, depth: number)}
	<div class="flex items-center gap-2 py-1 {depth > 0 ? 'ml-4 pl-3 border-l border-border' : ''}">
		<span class="size-2 rounded-full shrink-0" style="background-color: {n.color || 'var(--color-accent)'}"></span>
		<a
			href="/wordbook/{n.slug}"
			class="text-sm transition-colors hover:text-link {n.slug === currentSlug ? 'font-bold text-link' : 'text-secondary'}"
		>
			{n.name}
		</a>
		{#if n.nativeName}
			<span class="text-xs text-faint italic">{n.nativeName}</span>
		{/if}
		{#if n.languageType !== 'language'}
			<span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-raised text-dim">{n.languageType}</span>
		{/if}
	</div>
	{#each n.children as child}
		{@render node(child, depth + 1)}
	{/each}
{/snippet}

{@render node(tree, 0)}
