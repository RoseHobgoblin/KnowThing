<script lang="ts">
	import type { PageData } from './$types.js'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{m.nav_recent_changes()} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm">
	<div class="px-6 py-4 border-b border-border-subtle">
		<h1 class="text-xl font-bold text-heading">{m.nav_recent_changes()}</h1>
	</div>

	{#if data.edits.length === 0}
		<div class="p-6 text-center text-dim">{m.dash_recent_no_edits()}</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.edits as edit (edit.id)}
				<div class="px-6 py-3 flex items-start gap-4">
					<div class="flex-1 min-w-0">
						<a href="/{edit.domain}/{edit.parentPath ? `${edit.parentPath}/` : ''}{edit.pageSlug}" class="text-link font-medium text-sm hover:text-link-hover">{edit.title}</a>
							{#if edit.domain !== 'know'}<span class="text-xs text-secondary bg-raised px-1.5 py-0.5 rounded-sm">{edit.domain}</span>{/if}
						{#if edit.editSummary}
							<span class="text-secondary text-sm ml-1">— {edit.editSummary}</span>
						{/if}
						<div class="text-xs text-secondary mt-0.5">
							{edit.username ?? m.dash_unknown_user()}
							<span class="mx-1">&middot;</span>
							{new Date(edit.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
							{#if edit.sizeBytes}
								<span class="mx-1">&middot;</span>
								<span class="text-secondary">{(edit.sizeBytes / 1024).toFixed(1)} KB</span>
							{/if}
						</div>
					</div>
					<a href="/{edit.domain}/{edit.parentPath ? `${edit.parentPath}/` : ''}{edit.pageSlug}" class="text-xs text-secondary shrink-0 hover:text-link">{m.dash_history()}</a>
				</div>
			{/each}
		</div>

		<div class="px-6 py-3 border-t border-border-subtle flex justify-between text-sm">
			{#if data.page > 1}
				<a href="/dashboard/recent?page={data.page - 1}" class="text-link hover:text-link-hover">{m.common_previous()}</a>
			{:else}
				<span></span>
			{/if}
			{#if data.edits.length === data.perPage}
				<a href="/dashboard/recent?page={data.page + 1}" class="text-link hover:text-link-hover">{m.common_next()}</a>
			{/if}
		</div>
	{/if}
</div>
