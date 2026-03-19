<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	let selectedOld = $state<number | null>(null);
	let selectedNew = $state<number | null>(null);

	function compareDiff() {
		if (selectedOld && selectedNew) {
			window.location.href = `/know/${data.slug}/history?diff=${selectedNew}&against=${selectedOld}`;
		}
	}
</script>

<svelte:head>
	<title>History: {data.title} — KnowThing</title>
</svelte:head>

<div class="bg-white rounded-lg shadow-sm border border-stone-200">
	<div class="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-stone-900">Revision History</h1>
			<a href="/know/{data.slug}" class="text-amber-700 hover:text-amber-900 text-sm">{data.title}</a>
		</div>
		{#if selectedOld && selectedNew}
			<button onclick={compareDiff} class="px-4 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 transition-colors">
				Compare selected
			</button>
		{/if}
	</div>

	{#if data.diff}
		<!-- Diff view -->
		<div class="px-6 py-4 border-b border-stone-200 bg-stone-50">
			<div class="flex items-center justify-between text-xs text-stone-500 mb-3">
				<span>Older: {data.diffOldLabel}</span>
				<span>Newer: {data.diffNewLabel}</span>
			</div>
			<div class="font-mono text-xs leading-relaxed overflow-x-auto">
				{#each data.diff as part}
					{#if part.added}
						<div class="bg-green-50 text-green-800 border-l-4 border-green-400 px-2 py-0.5">{part.value}</div>
					{:else if part.removed}
						<div class="bg-red-50 text-red-800 border-l-4 border-red-400 px-2 py-0.5">{part.value}</div>
					{:else}
						<div class="text-stone-600 px-2 py-0.5">{part.value}</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	{#if data.history.length === 0}
		<div class="p-6 text-center text-stone-500">No revisions yet.</div>
	{:else}
		<div class="divide-y divide-stone-100">
			{#each data.history as rev, i}
				<div class="px-6 py-3 flex items-center gap-4">
					<div class="flex gap-2 shrink-0">
						<label class="text-xs text-stone-400">
							<input type="radio" name="old" value={rev.id} bind:group={selectedOld} class="accent-amber-600" />
						</label>
						<label class="text-xs text-stone-400">
							<input type="radio" name="new" value={rev.id} bind:group={selectedNew} class="accent-amber-600" />
						</label>
					</div>
					<div class="flex-1 min-w-0 text-sm">
						<span class="text-stone-600">
							{new Date(rev.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
						</span>
						<span class="text-stone-400 mx-1.5">&middot;</span>
						<span class="text-stone-700">{rev.username || 'Unknown'}</span>
						<span class="text-stone-400 mx-1.5">&middot;</span>
						<span class="text-stone-400">{(rev.sizeBytes / 1024).toFixed(1)} KB</span>
						{#if rev.editSummary}
							<span class="text-stone-400 mx-1.5">&middot;</span>
							<span class="text-stone-500 italic">{rev.editSummary}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
