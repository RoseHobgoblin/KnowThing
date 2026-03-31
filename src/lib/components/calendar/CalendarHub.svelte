<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import { resolveDisplay } from '$lib/calendar/date-math.js'
	import type { CalendarConfig } from '$lib/calendar/types.js'
	import { page } from '$app/stores'
	import { invalidateAll, goto } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Star from 'phosphor-svelte/lib/Star'
	import { calendarBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let {
		calendars,
		primary,
	}: {
		calendars: (any & { config: CalendarConfig })[]
		primary: (any & { config: CalendarConfig }) | null
	} = $props()

	const isAdmin = $derived($page.data.isAdmin)

	let newCalendarName = $state('')
	let creating = $state(false)

	async function createCalendar() {
		if (!newCalendarName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/calendar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newCalendarName.trim(),
					staticData: {
						first_week_day: 0,
						weekdays: [{ name: 'Monday' }, { name: 'Tuesday' }, { name: 'Wednesday' }, { name: 'Thursday' }, { name: 'Friday' }, { name: 'Saturday' }, { name: 'Sunday' }],
						months: [{ name: 'Month 1', length: 30, month_type: 'regular' }],
						leap_days: [], moons: [], eras: [], seasons: [],
						display_moons: false, year_offset: 0, epoch_offset: 0,
					},
				}),
			})
			if (res.ok) {
				const cal = await res.json()
				pushSuccess(`Created "${cal.name}"`)
				newCalendarName = ''
				if (cal.slug) goto(`/calendar/${cal.slug}`)
				else invalidateAll()
			} else {
				const body = await res.json().catch(() => ({}))
				pushError(body.error || 'Failed to create calendar')
			}
		} finally {
			creating = false
		}
	}
</script>

<svelte:head>
	<title>Calendar — KnowThing</title>
</svelte:head>

<ArticleShell breadcrumbs={calendarBreadcrumbs()} title="Calendar">
	{#if primary}
		{@const resolved = resolveDisplay(primary.config)}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
			<div class="max-w-md">
				<CalendarWidget config={primary.config} />
			</div>
			<div class="bg-raised border border-border-subtle p-4 space-y-2">
				<h3 class="text-sm font-semibold text-heading">{primary.name}</h3>
				<p class="text-sm text-body">
					{resolved.day_of_week_name}, {resolved.day} {resolved.month_name}, {resolved.year_display}
				</p>
				{#if resolved.era_name}
					<p class="text-xs text-secondary">Era: {resolved.era_name}</p>
				{/if}
				{#if resolved.season_name}
					<p class="text-xs text-secondary">Season: {resolved.season_name}</p>
				{/if}
				<a href="/calendar/{primary.slug}" class="inline-block mt-2 text-xs text-link hover:text-link-hover hover:underline">View full page →</a>
			</div>
		</div>
	{/if}

	{#if calendars.length > 0}
		<div class="space-y-2">
			{#each calendars as cal (cal.id)}
				<a href="/calendar/{cal.slug}" class="flex items-center justify-between px-4 py-3 bg-raised border border-border-subtle transition-colors hover:border-border">
					<div class="flex items-center gap-2">
						<span class="text-body font-medium">{cal.name}</span>
						{#if cal.isPrimary}
							<Star size={12} weight="fill" class="text-accent" />
						{/if}
					</div>
					{#if cal.description}
						<span class="text-xs text-dim">{cal.description}</span>
					{/if}
				</a>
			{/each}
		</div>
	{:else}
		<p class="text-dim text-center py-8">No calendars configured yet.</p>
	{/if}

	{#if isAdmin}
		<div class="mt-8 border border-border-subtle bg-raised p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">New Calendar</h2>
			<div class="flex gap-2 items-end">
				<Input bind:value={newCalendarName} placeholder="Calendar name" containerClass="flex-1" />
				<Button onclick={createCalendar} loading={creating} disabled={!newCalendarName.trim()}>
					{creating ? 'Creating...' : 'Create'}
				</Button>
			</div>
		</div>
	{/if}
</ArticleShell>
