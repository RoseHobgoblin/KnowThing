<script lang="ts">
	import type { PageData } from './$types.js'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{m.dash_orphans_title()} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm">
	<div class="px-6 py-4 border-b border-border-subtle">
		<h1 class="text-xl font-bold text-heading">{m.dash_orphans_title()}</h1>
		<p class="text-sm text-dim mt-1">{m.dash_orphans_desc()}</p>
	</div>

	{#if data.orphans.length === 0}
		<div class="p-6 text-center text-dim">{m.dash_orphans_empty()}</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.orphans as p (`${p.domain}/${p.parentPath ?? ''}/${p.slug}`)}
				<div class="px-6 py-3 flex items-center justify-between">
					<div class="flex items-center gap-2 min-w-0">
						<a href="/{p.domain}/{p.parentPath ? `${p.parentPath}/` : ''}{p.slug}" class="text-link font-medium text-sm hover:text-link-hover">{p.title}</a>
						{#if p.domain !== 'know'}<span class="text-xs text-secondary bg-raised px-1.5 py-0.5 rounded">{p.domain}</span>{/if}
					</div>
					<span class="text-xs text-secondary">
						{new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
