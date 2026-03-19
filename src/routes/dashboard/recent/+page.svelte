<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Recent Changes — KnowThing</title>
</svelte:head>

<div class="bg-white rounded-lg shadow-sm border border-stone-200">
	<div class="px-6 py-4 border-b border-stone-100">
		<h1 class="text-xl font-bold text-stone-900">Recent Changes</h1>
	</div>

	{#if data.edits.length === 0}
		<div class="p-6 text-center text-stone-500">No edits yet.</div>
	{:else}
		<div class="divide-y divide-stone-100">
			{#each data.edits as edit}
				<div class="px-6 py-3 flex items-start gap-4">
					<div class="flex-1 min-w-0">
						<a href="/know/{edit.pageSlug}" class="text-amber-700 hover:text-amber-900 font-medium text-sm">{edit.title}</a>
						{#if edit.editSummary}
							<span class="text-stone-400 text-sm ml-1">— {edit.editSummary}</span>
						{/if}
						<div class="text-xs text-stone-400 mt-0.5">
							{edit.username ?? 'Unknown'}
							<span class="mx-1">&middot;</span>
							{new Date(edit.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
							{#if edit.sizeBytes}
								<span class="mx-1">&middot;</span>
								<span class="text-stone-300">{(edit.sizeBytes / 1024).toFixed(1)} KB</span>
							{/if}
						</div>
					</div>
					<a href="/know/{edit.pageSlug}/history" class="text-xs text-stone-400 hover:text-amber-700 shrink-0">history</a>
				</div>
			{/each}
		</div>

		<div class="px-6 py-3 border-t border-stone-100 flex justify-between text-sm">
			{#if data.page > 1}
				<a href="/dashboard/recent?page={data.page - 1}" class="text-amber-700 hover:text-amber-900">Previous</a>
			{:else}
				<span></span>
			{/if}
			{#if data.edits.length === data.perPage}
				<a href="/dashboard/recent?page={data.page + 1}" class="text-amber-700 hover:text-amber-900">Next</a>
			{/if}
		</div>
	{/if}
</div>
