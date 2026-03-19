<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
		<h1 class="text-xl font-bold text-stone-900 mb-1">Welcome back, {data.user?.username}</h1>
		<p class="text-stone-500 text-sm">Contributor dashboard</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<a href="/know/create" class="bg-white rounded-lg shadow-sm border border-stone-200 p-4 hover:border-amber-300 transition-colors group">
			<div class="text-2xl font-bold text-amber-700 group-hover:text-amber-600">{data.pageCount}</div>
			<div class="text-xs text-stone-500 mt-1">Total articles</div>
		</a>
		<a href="/dashboard/recent" class="bg-white rounded-lg shadow-sm border border-stone-200 p-4 hover:border-amber-300 transition-colors">
			<div class="font-semibold text-stone-800">Recent Changes</div>
			<div class="text-xs text-stone-500 mt-1">View all recent edits</div>
		</a>
		<a href="/dashboard/wanted" class="bg-white rounded-lg shadow-sm border border-stone-200 p-4 hover:border-amber-300 transition-colors">
			<div class="font-semibold text-stone-800">Wanted Pages</div>
			<div class="text-xs text-stone-500 mt-1">Pages that need creating</div>
		</a>
	</div>

	{#if data.recentEdits.length > 0}
		<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
			<h2 class="font-semibold text-stone-800 mb-3">Your Recent Edits</h2>
			<div class="space-y-2">
				{#each data.recentEdits as edit}
					<div class="flex items-center justify-between text-sm border-b border-stone-100 pb-2">
						<div>
							<a href="/know/{edit.pageSlug}" class="text-amber-700 hover:text-amber-900 font-medium">{edit.title}</a>
							{#if edit.editSummary}
								<span class="text-stone-400 ml-2">— {edit.editSummary}</span>
							{/if}
						</div>
						<span class="text-xs text-stone-400 shrink-0 ml-4">
							{new Date(edit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
