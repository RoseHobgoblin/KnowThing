<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { calendarPresets } from '$lib/calendar/presets.js'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import { resolveDisplay } from '$lib/calendar/date-math.js'
	import type { CalendarConfig } from '$lib/calendar/types.js'
	import { page } from '$app/stores'
	import { invalidateAll, goto } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import { calendarBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let {
		calendars,
		primary,
	}: {
		calendars: (any & { config: CalendarConfig })[]
		primary: (any & { config: CalendarConfig }) | null
	} = $props()

	const permissions = $derived($page.data.permissions)

	let newCalendarName = $state('')
	let selectedPreset = $state('')
	let creating = $state(false)

	const presetItems = [
		{ value: '', label: 'Blank' },
		...calendarPresets.map(p => ({ value: p.label, label: `${p.label} — ${p.description}` })),
	]

	$effect(() => {
		const preset = calendarPresets.find(p => p.label === selectedPreset)
		if (preset && !newCalendarName.trim()) {
			newCalendarName = preset.name
		}
	})

	async function createCalendar() {
		if (!newCalendarName.trim()) return
		creating = true
		const preset = calendarPresets.find(p => p.label === selectedPreset)
		const staticData = preset?.staticData ?? {
			first_week_day: 0,
			weekdays: [{ name: 'Monday' }, { name: 'Tuesday' }, { name: 'Wednesday' }, { name: 'Thursday' }, { name: 'Friday' }, { name: 'Saturday' }, { name: 'Sunday' }],
			months: [{ name: 'Month 1', length: 30, month_type: 'regular' }],
			leap_days: [], moons: [], eras: [], seasons: [],
			display_moons: false, year_offset: 0, epoch_offset: 0,
		}
		try {
			const res = await fetch('/api/calendar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newCalendarName.trim(),
					staticData,
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
		<div class="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-[minmax(0,28rem)_1fr]">
			<div>
				<CalendarWidget config={primary.config} />
			</div>
			<div class="bg-raised border border-border-subtle p-5 flex flex-col justify-center space-y-3">
				<h3 class="text-base font-semibold text-heading font-heading">{primary.name}</h3>
				<p class="text-lg text-body font-medium">
					{resolved.day_of_week_name}, {resolved.day} {resolved.month_name}, {resolved.year_display}
				</p>
				<div class="flex flex-wrap gap-x-4 gap-y-1">
					{#if resolved.era_name}
						<p class="text-sm text-secondary">Era: <span class="text-body">{resolved.era_name}</span></p>
					{/if}
					{#if resolved.season_name}
						<p class="text-sm text-secondary">Season: <span class="text-body">{resolved.season_name}</span></p>
					{/if}
				</div>
				<a href="/calendar/{primary.slug}" class="inline-block mt-1 text-sm text-link font-medium transition-colors hover:text-link-hover">View full page →</a>
			</div>
		</div>
	{/if}

	{#if calendars.length > 0}
		<h2 class="text-sm font-semibold text-heading uppercase tracking-wider mb-3">All Calendars</h2>
		<div class="space-y-1.5">
			{#each calendars as cal (cal.id)}
				<a href="/calendar/{cal.slug}" class="
					flex items-center justify-between px-4 py-3 bg-raised border border-border-subtle
					transition-colors group
					hover:border-border hover:bg-surface
				">
					<div class="flex items-center gap-2">
						<span class="text-body font-medium transition-colors group-hover:text-heading">{cal.name}</span>
						{#if cal.isPrimary}
							<StarIcon size={12} weight="fill" class="text-accent" />
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

	{#if permissions.canManageSettings}
		<div class="mt-8 border border-border-subtle bg-raised p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">New Calendar</h2>
			<Select type="single" label="Start from preset" bind:value={selectedPreset} items={presetItems} />
			<div class="flex gap-2 items-end">
				<Input bind:value={newCalendarName} placeholder="Calendar name" containerClass="flex-1" />
				<Button onclick={createCalendar} loading={creating} disabled={!newCalendarName.trim()}>
					{creating ? 'Creating...' : 'Create'}
				</Button>
			</div>
		</div>
	{:else if permissions.isAuthenticated}
		<div class="mt-8 border border-border-subtle bg-raised p-5">
			<p class="text-sm text-faint">Admin role required to create calendars.</p>
		</div>
	{/if}
</ArticleShell>
