<script lang="ts">
	import type { PageData } from './$types.js'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{m.dash_wanted_title()} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm">
	<div class="px-6 py-4 border-b border-border-subtle">
		<h1 class="text-xl font-bold text-heading">{m.dash_wanted_title()}</h1>
		<p class="text-sm text-dim mt-1">{m.dash_wanted_desc()}</p>
	</div>

	{#if data.wanted.length === 0}
		<div class="p-6 text-center text-dim">{m.dash_wanted_empty()}</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.wanted as w (`${w.domain}/${w.slug}`)}
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
							<span class="text-xs text-secondary bg-raised px-1.5 py-0.5 rounded-sm">{w.domain}</span>
						{/if}
					</div>
					<span class="text-xs text-secondary shrink-0">{w.linkCount} {w.linkCount === 1 ? m.dash_link_one() : m.dash_link_other()}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
