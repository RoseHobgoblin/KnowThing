<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Orphaned Pages — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm border border-border">
	<div class="px-6 py-4 border-b border-border-subtle">
		<h1 class="text-xl font-bold text-heading">Orphaned Pages</h1>
		<p class="text-sm text-dim mt-1">Articles no other page links to.</p>
	</div>

	{#if data.orphans.length === 0}
		<div class="p-6 text-center text-dim">No orphaned pages. Every article has at least one inbound link.</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.orphans as p}
				<div class="px-6 py-3 flex items-center justify-between">
					<a href="/know/{p.slug}" class="text-link font-medium text-sm hover:text-link-hover">{p.title}</a>
					<span class="text-xs text-faint">
						{new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
