<script lang="ts">
	import type { PageData } from './$types.js'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / 1048576).toFixed(1)} MB`
	}

	const s = $derived(data.stats)
</script>

<svelte:head>
	<title>{m.dash_stats_title()} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm p-6">
	<h1 class="text-2xl font-bold text-heading mb-6">{m.dash_stats_title()}</h1>

	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.articles}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">{m.dash_stat_articles()}</div>
		</div>
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.revisions}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">{m.dash_stat_revisions()}</div>
		</div>
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.categories}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">{m.nav_categories()}</div>
		</div>
		<div class="bg-page p-4 text-center">
			<div class="text-3xl font-bold text-link">{s.mediaFiles}</div>
			<div class="text-xs text-dim mt-1 uppercase tracking-wide">{m.dash_stat_media_files()}</div>
		</div>
	</div>

	<div class="mt-6 space-y-2 text-sm text-secondary">
		<div class="flex justify-between">
			<span>{m.dash_stat_total_content_size()}</span>
			<span class="font-medium text-body">{formatBytes(s.totalContentSize)}</span>
		</div>
		<div class="flex justify-between">
			<span>{m.dash_stat_total_media_size()}</span>
			<span class="font-medium text-body">{formatBytes(s.mediaTotalSize)}</span>
		</div>
		{#if s.lastEdit}
			<div class="flex justify-between">
				<span>{m.dash_stat_last_edit()}</span>
				<span class="font-medium text-body">{new Date(s.lastEdit).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
			</div>
		{/if}
	</div>
</div>
