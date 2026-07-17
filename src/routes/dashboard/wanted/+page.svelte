<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Wanted Pages — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm">
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
					<div class="flex items-center gap-2 min-w-0">
						{#if w.domain === 'know'}
							<a
								href="/know/create?slug={encodeURIComponent(w.slug)}&title={encodeURIComponent(w.slug.replaceAll('_', ' '))}"
								class="text-error font-medium text-sm hover:text-error-text"
							>
								{w.slug.replaceAll('_', ' ')}
							</a>
						{:else}
							<span class="text-error font-medium text-sm">{w.slug.replaceAll('_', ' ')}</span>
							<span class="text-xs text-secondary bg-raised px-1.5 py-0.5 rounded">{w.domain}</span>
						{/if}
					</div>
					<span class="text-xs text-secondary shrink-0">{w.linkCount} {w.linkCount === 1 ? 'link' : 'links'}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
