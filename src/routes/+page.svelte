<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import ShareMeta from '$lib/components/ShareMeta.svelte'

	let { data }: { data: PageData } = $props()
	const sc = $derived($page.data.siteConfig)
</script>

<svelte:head>
	<title>{sc?.siteName ?? 'KnowThing'}</title>
</svelte:head>

<ShareMeta
	title={sc?.siteName ?? 'KnowThing'}
	description={sc?.siteTagline ?? 'A collaborative encyclopedia'}
/>

<div class="space-y-8">
	<!-- Hero -->
	<div class="text-center py-6">
		<h1 class="text-3xl font-bold text-heading md:text-4xl">
			{sc?.siteName ?? 'KnowThing'}
		</h1>
		<p class="text-secondary mt-2">{sc?.siteTagline ?? 'A collaborative encyclopedia'}</p>
		{#if sc?.institutionName}
			<p class="text-faint text-sm mt-1">Maintained by {sc.institutionName}</p>
		{/if}
	</div>

	<!-- Stats bar -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-5">
		{#each [
			{ label: 'Articles', value: data.stats.articles },
			{ label: 'Words', value: data.stats.words },
			{ label: 'Languages', value: data.stats.languages },
			{ label: 'Media', value: data.stats.media },
			{ label: 'Contributors', value: data.stats.users },
		] as stat (stat.label)}
			<div class="bg-surface border border-border p-3 text-center">
				<div class="text-xl font-bold text-heading">{stat.value.toLocaleString()}</div>
				<div class="text-xs text-faint">{stat.label}</div>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Featured article -->
		{#if data.featured}
			<div class="bg-surface border border-border p-5">
				<h2 class="text-xs font-semibold text-faint uppercase tracking-wider mb-3">Featured article</h2>
				<h3 class="text-lg font-bold text-heading mb-2">
					<a href="/know/{data.featured.slug}" class="text-link transition-colors hover:text-link-hover">{data.featured.title}</a>
				</h3>
				{#if data.featured.summary}
					<p class="text-sm text-body leading-relaxed">{data.featured.summary}</p>
				{/if}
				<a href="/know/{data.featured.slug}" class="text-sm text-link mt-3 inline-block transition-colors hover:text-link-hover">
					Read more →
				</a>
			</div>
		{:else}
			<div class="bg-surface border border-border p-5 text-center">
				<h2 class="text-xs font-semibold text-faint uppercase tracking-wider mb-3">Get started</h2>
				<p class="text-sm text-dim mb-4">No articles yet. Create your first page.</p>
				<a href="/know/create" class="inline-block bg-accent text-surface px-5 py-2 font-medium text-sm transition-colors hover:bg-accent-hover">Create a page</a>
			</div>
		{/if}

		<!-- Today + Word of the day -->
		<div class="space-y-4">
			{#if data.calendarInfo}
				<a href="/calendar" class="block bg-surface border border-border p-5 transition-colors hover:border-accent-border group">
					<h2 class="text-xs font-semibold text-faint uppercase tracking-wider mb-2">Today</h2>
					<div class="text-lg font-bold text-heading group-hover:text-link transition-colors">
						{data.calendarInfo.dayName}, {data.calendarInfo.day} {data.calendarInfo.monthName}
					</div>
					<div class="text-sm text-secondary">{data.calendarInfo.yearDisplay}</div>
					{#if data.calendarInfo.seasonName}
						<div class="text-xs text-faint mt-1">{data.calendarInfo.seasonName}</div>
					{/if}
				</a>
			{/if}

			{#if data.randomWord}
				<a
					href="/wordbook/{data.randomWord.languageSlug}/{encodeURIComponent(data.randomWord.word)}"
					class="block bg-surface border border-border p-5 transition-colors hover:border-accent-border group"
				>
					<h2 class="text-xs font-semibold text-faint uppercase tracking-wider mb-2">From the {sc?.wordbookName ?? 'Wordbook'}</h2>
					<div class="flex items-baseline gap-2">
						<span class="text-lg font-bold font-serif text-heading group-hover:text-link transition-colors">{data.randomWord.word}</span>
						{#if data.randomWord.pronunciation}
							<span class="text-sm text-faint font-mono">{data.randomWord.pronunciation}</span>
						{/if}
					</div>
					<div class="text-xs text-dim mt-0.5">{data.randomWord.languageName}</div>
					{#if data.randomWord.definition}
						<p class="text-sm text-body mt-2">{data.randomWord.definition}</p>
					{/if}
				</a>
			{/if}
		</div>
	</div>

	<!-- Recent changes -->
	{#if data.recentEdits.length > 0}
		<div class="bg-surface border border-border">
			<div class="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
				<h2 class="text-xs font-semibold text-faint uppercase tracking-wider">Recent changes</h2>
				<a href="/dashboard/recent" class="text-xs text-link transition-colors hover:text-link-hover">View all →</a>
			</div>
			<div class="divide-y divide-border-subtle">
				{#each data.recentEdits as edit (edit.createdAt)}
					<div class="px-5 py-2.5 flex items-center justify-between">
						<div class="min-w-0">
							<a href="/know/{edit.pageSlug}" class="text-sm text-link font-medium transition-colors hover:text-link-hover">{edit.title}</a>
							{#if edit.editSummary}
								<span class="text-xs text-faint ml-2">{edit.editSummary}</span>
							{/if}
						</div>
						<time class="text-[11px] text-faint shrink-0 ml-4">
							{new Date(edit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
						</time>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
