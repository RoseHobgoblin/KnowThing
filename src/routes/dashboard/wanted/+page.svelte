<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Wanted Pages — KnowThing</title>
</svelte:head>

<div class="bg-white rounded-lg shadow-sm border border-stone-200">
	<div class="px-6 py-4 border-b border-stone-100">
		<h1 class="text-xl font-bold text-stone-900">Wanted Pages</h1>
		<p class="text-sm text-stone-500 mt-1">Pages linked to but not yet created, sorted by demand.</p>
	</div>

	{#if data.wanted.length === 0}
		<div class="p-6 text-center text-stone-500">No wanted pages. All linked articles exist.</div>
	{:else}
		<div class="divide-y divide-stone-100">
			{#each data.wanted as w}
				<div class="px-6 py-3 flex items-center justify-between">
					<a
						href="/know/create?slug={encodeURIComponent(w.slug)}&title={encodeURIComponent(w.slug.replace(/_/g, ' '))}"
						class="text-red-500 hover:text-red-700 font-medium text-sm"
					>
						{w.slug.replace(/_/g, ' ')}
					</a>
					<span class="text-xs text-stone-400">{w.linkCount} {w.linkCount === 1 ? 'link' : 'links'}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
