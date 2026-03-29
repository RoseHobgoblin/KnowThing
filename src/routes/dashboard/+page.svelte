<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div class="bg-surface shadow-sm border border-border p-6">
		<h1 class="text-xl font-bold text-heading mb-1">Welcome back, {data.user?.username}</h1>
		<p class="text-dim text-sm">Contributor dashboard</p>
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		<a href="/know/create" class="
			bg-surface shadow-sm border border-border p-4 transition-colors group
			hover:border-accent-border
		">
			<div class="text-2xl font-bold text-link group-hover:text-accent">{data.pageCount}</div>
			<div class="text-xs text-dim mt-1">Total articles</div>
		</a>
		<a href="/dashboard/recent" class="
			bg-surface shadow-sm border border-border p-4 transition-colors
			hover:border-accent-border
		">
			<div class="font-semibold text-body">Recent Changes</div>
			<div class="text-xs text-dim mt-1">View all recent edits</div>
		</a>
		<a href="/dashboard/wanted" class="
			bg-surface shadow-sm border border-border p-4 transition-colors
			hover:border-accent-border
		">
			<div class="font-semibold text-body">Wanted Pages</div>
			<div class="text-xs text-dim mt-1">Pages that need creating</div>
		</a>
	</div>

	{#if data.recentEdits.length > 0}
		<div class="bg-surface shadow-sm border border-border p-6">
			<h2 class="font-semibold text-body mb-3">Your Recent Edits</h2>
			<div class="space-y-2">
				{#each data.recentEdits as edit}
					<div class="flex items-center justify-between text-sm border-b border-border-subtle pb-2">
						<div>
							<a href="/know/{edit.pageSlug}" class="text-link font-medium hover:text-link-hover">{edit.title}</a>
							{#if edit.editSummary}
								<span class="text-faint ml-2">— {edit.editSummary}</span>
							{/if}
						</div>
						<span class="text-xs text-faint shrink-0 ml-4">
							{new Date(edit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
