<script lang="ts">
	import type { PageData } from './$types.js'
	import { slugify } from '$lib/renderer/context.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Categories — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm p-6">
	<h1 class="text-2xl font-bold text-heading mb-6">Categories</h1>

	{#if data.categories.length === 0}
		<p class="text-dim">No categories yet. Categories are created when articles use <code>[[Category:Name]]</code> markup.</p>
	{:else}
		<div class="flex flex-wrap gap-2">
			{#each data.categories as cat}
				<a
					href="/know/category:{slugify(cat.name)}"
					class="
						inline-flex items-center gap-1.5 bg-raised text-secondary px-4 py-2 text-sm
						transition-colors
						hover:bg-accent-subtle hover:text-link
					"
				>
					{cat.name}
					<span class="text-xs text-secondary bg-border px-1.5 py-0.5">{cat.count}</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
