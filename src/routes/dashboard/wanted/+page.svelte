<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Wanted Pages — KnowThing</title>
</svelte:head>

<div class="bg-surface rounded-lg shadow-sm border border-border">
	<div class="px-6 py-4 border-b border-border-subtle">
		<h1 class="text-xl font-bold text-heading">Wanted Pages</h1>
		<p class="text-sm text-dim mt-1">Pages linked to but not yet created, sorted by demand.</p>
	</div>

	{#if data.wanted.length === 0}
		<div class="p-6 text-center text-dim">No wanted pages. All linked articles exist.</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.wanted as w}
				<div class="px-6 py-3 flex items-center justify-between">
					<a
						href="/know/create?slug={encodeURIComponent(w.slug)}&title={encodeURIComponent(w.slug.replaceAll('_', ' '))}"
						class="text-red-500 font-medium text-sm hover:text-red-700"
					>
						{w.slug.replaceAll('_', ' ')}
					</a>
					<span class="text-xs text-faint">{w.linkCount} {w.linkCount === 1 ? 'link' : 'links'}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
