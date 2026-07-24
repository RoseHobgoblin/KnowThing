<script lang="ts">
	import type { PageData } from './$types.js'
	import { slugify } from '$lib/renderer/context.js'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{m.nav_categories()} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm p-6">
	<h1 class="text-2xl font-bold text-heading mb-6">{m.nav_categories()}</h1>

	{#if data.categories.length === 0}
		<p class="text-dim">{m.dash_categories_empty_before()}<code>[[Category:Name]]</code>{m.dash_categories_empty_after()}</p>
	{:else}
		<div class="flex flex-wrap gap-2">
			{#each data.categories as cat (cat.name)}
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
