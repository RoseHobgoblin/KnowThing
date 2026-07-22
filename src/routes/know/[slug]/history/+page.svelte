<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()

	let selectedOld = $state<number | null>(null)
	let selectedNew = $state<number | null>(null)

	function compareDiff() {
		if (selectedOld && selectedNew) {
			globalThis.location.href = `/know/${data.slug}/history?diff=${selectedNew}&against=${selectedOld}`
		}
	}
</script>

<svelte:head>
	<title>History: {data.title} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm">
	<div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-heading">Revision History</h1>
			<a href="/know/{data.slug}" class="text-link text-sm hover:text-link-hover">{data.title}</a>
		</div>
		{#if selectedOld && selectedNew}
			<button onclick={compareDiff} class="
				px-4 py-1.5 bg-accent text-surface text-sm transition-colors
				hover:bg-accent-hover
			">
				Compare selected
			</button>
		{/if}
	</div>

	{#if data.diff}
		<!-- Diff view -->
		<div class="px-6 py-4 border-b border-border bg-page">
			<div class="flex items-center justify-between text-xs text-dim mb-3">
				<span>Older: {data.diffOldLabel}</span>
				<span>Newer: {data.diffNewLabel}</span>
			</div>
			<div class="font-mono text-xs/relaxed overflow-x-auto">
				{#each data.diff as part, index (index)}
					{#if part.added}
						<div class="bg-diff-add-bg text-diff-add-text border-l-4 border-diff-add-border px-2 py-0.5">{part.value}</div>
					{:else if part.removed}
						<div class="bg-diff-rm-bg text-diff-rm-text border-l-4 border-diff-rm-border px-2 py-0.5">{part.value}</div>
					{:else}
						<div class="text-secondary px-2 py-0.5">{part.value}</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	{#if data.history.length === 0}
		<div class="p-6 text-center text-dim">No revisions yet.</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.history as rev, index (rev.id)}
				<div class="px-6 py-3 flex items-center gap-4">
					<div class="flex gap-2 shrink-0">
						<label class="text-xs text-secondary">
							<input type="radio" name="old" value={rev.id} bind:group={selectedOld} class="accent-accent" />
						</label>
						<label class="text-xs text-secondary">
							<input type="radio" name="new" value={rev.id} bind:group={selectedNew} class="accent-accent" />
						</label>
					</div>
					<div class="flex-1 min-w-0 text-sm">
						<span class="text-secondary">
							{new Date(rev.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
						</span>
						<span class="text-secondary mx-1.5">&middot;</span>
						<span class="text-secondary">{rev.username || 'Unknown'}</span>
						<span class="text-secondary mx-1.5">&middot;</span>
						<span class="text-secondary">{(rev.sizeBytes / 1024).toFixed(1)} KB</span>
						{#if rev.editSummary}
							<span class="text-secondary mx-1.5">&middot;</span>
							<span class="text-dim italic">{rev.editSummary}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
