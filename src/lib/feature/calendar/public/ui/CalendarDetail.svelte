<script lang="ts">
	import type { CalendarConfig, ResolvedDate } from 'rimecraft'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import CalendarWidget from './CalendarWidget.svelte'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon'
	import { calendarDetailBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { m } from '$lib/paraglide/messages.js'

	let {
		calendar,
		config,
		resolved,
	}: {
		calendar: { id: number, slug: string, name: string, description: string | null }
		config: CalendarConfig
		resolved: ResolvedDate | null
	} = $props()

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})
</script>

<ArticleShell
	breadcrumbs={calendarDetailBreadcrumbs(calendar.name)}
	title={calendar.name}
>
	{#snippet actions()}
		{#if permissions.canConfigureCalendar}
			<a href="/Calendar:{calendar.slug}/configure" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
				<GearSixIcon size={14} weight="fill" />{m.common_configure()}
			</a>
		{:else if permissions.isAuthenticated}
			<span class="text-secondary text-sm">{m.common_view_only_editor()}</span>
		{/if}
	{/snippet}

	<div class="max-w-md mx-auto mb-6">
		{#key JSON.stringify(config.static_data)}
			<CalendarWidget {config} />
		{/key}
	</div>

	{#if resolved}
		<div class="bg-raised p-4 mb-6 space-y-2">
			<h3 class="text-sm font-semibold text-heading">{m.cal_current_date()}</h3>
			<p class="text-sm text-body">
				{resolved.day_of_week_name}, {resolved.day} {resolved.month_name}, {resolved.year_display}
			</p>
			{#if resolved.era_name}
				<p class="text-xs text-secondary">{m.cal_era_label()} {resolved.era_name}</p>
			{/if}
			{#if resolved.season_name}
				<p class="text-xs text-secondary">{m.cal_season_label()} {resolved.season_name}</p>
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

	<details class="bg-raised mb-6">
		<summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-heading select-none transition-colors hover:bg-surface">
			{m.cal_magic_words_reference()}
		</summary>
		<div class="px-4 pb-4">
			<p class="text-xs text-secondary mb-2">{m.cal_magic_words_desc()}</p>
			<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
				<code class="text-accent">{'{{CURRENTYEAR}}'}</code><span class="text-secondary">{m.cal_mw_current_year()}</span>
				<code class="text-accent">{'{{CURRENTMONTHNAME}}'}</code><span class="text-secondary">{m.cal_mw_month_name()}</span>
				<code class="text-accent">{'{{CURRENTDAY}}'}</code><span class="text-secondary">{m.cal_mw_day_of_month()}</span>
				<code class="text-accent">{'{{CURRENTDAYNAME}}'}</code><span class="text-secondary">{m.cal_mw_weekday_name()}</span>
				<code class="text-accent">{'{{CURRENTERA}}'}</code><span class="text-secondary">{m.cal_mw_current_era()}</span>
				<code class="text-accent">{'{{CURRENTSEASON}}'}</code><span class="text-secondary">{m.cal_mw_current_season()}</span>
				<code class="text-accent">{'{{CURRENTYEARDISPLAY}}'}</code><span class="text-secondary">{m.cal_mw_year_with_era()}</span>
				<code class="text-accent">{'{{CURRENTFULLDISPLAY}}'}</code><span class="text-secondary">{m.cal_mw_full_date()}</span>
			</div>
		</div>
	</details>
</ArticleShell>
