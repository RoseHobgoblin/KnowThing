<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Orphaned Pages — KnowThing</title>
</svelte:head>

<div class="bg-white rounded-lg shadow-sm border border-stone-200">
	<div class="px-6 py-4 border-b border-stone-100">
		<h1 class="text-xl font-bold text-stone-900">Orphaned Pages</h1>
		<p class="text-sm text-stone-500 mt-1">Articles no other page links to.</p>
	</div>

	{#if data.orphans.length === 0}
		<div class="p-6 text-center text-stone-500">No orphaned pages. Every article has at least one inbound link.</div>
	{:else}
		<div class="divide-y divide-stone-100">
			{#each data.orphans as p}
				<div class="px-6 py-3 flex items-center justify-between">
					<a href="/know/{p.slug}" class="text-amber-700 hover:text-amber-900 font-medium text-sm">{p.title}</a>
					<span class="text-xs text-stone-400">
						{new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
