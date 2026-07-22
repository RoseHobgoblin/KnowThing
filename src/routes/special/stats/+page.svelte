<script lang="ts">
	import type { PageData } from './$types.js'

	let { data }: { data: PageData } = $props()

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / 1048576).toFixed(1)} MB`
	}

	const s = $derived(data.stats)
</script>

<svelte:head>
	<title>Statistics — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm p-6">
	<h1 class="text-2xl font-bold text-heading mb-6">Statistics</h1>

	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.articles}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">Articles</div>
		</div>
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.revisions}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">Revisions</div>
		</div>
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.categories}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">Categories</div>
		</div>
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.mediaFiles}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">Media Files</div>
		</div>
	</div>

	<div class="mt-6 space-y-2 text-sm text-secondary">
		<div class="flex justify-between">
			<span>Total content size</span>
			<span class="font-medium text-body">{formatBytes(s.totalContentSize)}</span>
		</div>
		<div class="flex justify-between">
			<span>Total media size</span>
			<span class="font-medium text-body">{formatBytes(s.mediaTotalSize)}</span>
		</div>
		{#if s.lastEdit}
			<div class="flex justify-between">
				<span>Last edit</span>
				<span class="font-medium text-body">{new Date(s.lastEdit).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
			</div>
		{/if}
	</div>
</div>
