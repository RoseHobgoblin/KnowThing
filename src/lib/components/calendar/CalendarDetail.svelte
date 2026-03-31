<script lang="ts">
	import type { CalendarConfig, ResolvedDate } from '$lib/calendar/types.js'
	import type { WikiNode } from '$lib/parser/types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import GearSixIcon from 'phosphor-svelte/lib/GearSix'
	import { calendarDetailBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let {
		calendar,
		config,
		resolved,
		wikiContent,
		ast,
	}: {
		calendar: { id: number, slug: string, name: string, description: string | null }
		config: CalendarConfig
		resolved: ResolvedDate | null
		wikiContent: string
		ast: WikiNode | null
	} = $props()

	const permissions = $derived($page.data.permissions)
	const layoutData = $derived($page.data)

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})
</script>

<ArticleShell
	breadcrumbs={calendarDetailBreadcrumbs(calendar.name)}
	title={calendar.name}
>
	{#snippet actions()}
		{#if permissions.canConfigureCalendar}
			<a href="/calendar/{calendar.slug}/configure" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
				<GearSixIcon size={14} weight="fill" />Configure
			</a>
		{:else if permissions.isAuthenticated}
			<span class="text-faint text-sm">View only. Editor role required to configure calendars.</span>
		{/if}
	{/snippet}

	<div class="max-w-md mx-auto mb-6">
		{#key JSON.stringify(config.static_data)}
			<CalendarWidget {config} />
		{/key}
	</div>

	{#if resolved}
		<div class="bg-raised border border-border-subtle p-4 mb-6 space-y-2">
			<h3 class="text-sm font-semibold text-heading">Current Date</h3>
			<p class="text-sm text-body">
				{resolved.day_of_week_name}, {resolved.day} {resolved.month_name}, {resolved.year_display}
			</p>
			{#if resolved.era_name}
				<p class="text-xs text-secondary">Era: {resolved.era_name}</p>
			{/if}
			{#if resolved.season_name}
				<p class="text-xs text-secondary">Season: {resolved.season_name}</p>
			{/if}
			{#if resolved.moon_phases.length > 0}
				<div class="flex flex-wrap gap-3 mt-1">
					{#each resolved.moon_phases as mp (mp.moon_name)}
						<span class="text-xs text-secondary">
							{mp.moon_name}: <span class="font-medium text-body">{mp.phase_name}</span>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<details class="bg-raised border border-border-subtle mb-6">
		<summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-heading select-none transition-colors hover:bg-surface">
			Magic Words Reference
		</summary>
		<div class="px-4 pb-4">
			<p class="text-xs text-faint mb-2">Use these in wiki articles to display live calendar data:</p>
			<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
				<code class="text-accent">{'{{CURRENTYEAR}}'}</code><span class="text-secondary">Current year number</span>
				<code class="text-accent">{'{{CURRENTMONTHNAME}}'}</code><span class="text-secondary">Month name</span>
				<code class="text-accent">{'{{CURRENTDAY}}'}</code><span class="text-secondary">Day of month</span>
				<code class="text-accent">{'{{CURRENTDAYNAME}}'}</code><span class="text-secondary">Weekday name</span>
				<code class="text-accent">{'{{CURRENTERA}}'}</code><span class="text-secondary">Current era</span>
				<code class="text-accent">{'{{CURRENTSEASON}}'}</code><span class="text-secondary">Current season</span>
				<code class="text-accent">{'{{CURRENTYEARDISPLAY}}'}</code><span class="text-secondary">Year with era format</span>
				<code class="text-accent">{'{{CURRENTFULLDISPLAY}}'}</code><span class="text-secondary">Full formatted date</span>
			</div>
		</div>
	</details>

	{#if ast}
		<article class="know-article">
			<WikiNodeComponent node={ast} />
		</article>
	{:else if !wikiContent}
		<p class="text-dim italic mt-4">No article content yet.</p>
	{/if}
</ArticleShell>
