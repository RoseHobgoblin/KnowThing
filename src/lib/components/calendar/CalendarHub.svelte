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
	import { normalizePermissions } from '$lib/permissions.js'
	import { invalidateAll, goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import { calendarBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let {
		calendars,
		primary,
	}: {
		calendars: (any & { config: CalendarConfig })[]
		primary: (any & { config: CalendarConfig }) | null
	} = $props()

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	let newCalendarName = $state('')
	let selectedPreset = $state('')


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

	const createCalendarMutation = createMutation(() => ({
		mutationFn: () => {
			const preset = calendarPresets.find(p => p.label === selectedPreset)
			const staticData = preset?.staticData ?? {
				first_week_day: 0,
				weekdays: [{ name: 'Monday' }, { name: 'Tuesday' }, { name: 'Wednesday' }, { name: 'Thursday' }, { name: 'Friday' }, { name: 'Saturday' }, { name: 'Sunday' }],
				months: [{ name: 'Month 1', length: 30, month_type: 'regular' }],
				leap_days: [], moons: [], eras: [], seasons: [],
				display_moons: false, year_offset: 0, epoch_offset: 0,
			}
			return api<{ name: string, slug?: string }>('POST', '/api/calendar', {
				name: newCalendarName.trim(),
				staticData,
			})
		},
		onSuccess: (cal) => {
			pushSuccess(`Created "${cal.name}"`)
			newCalendarName = ''
			if (cal.slug) goto(`/Calendar:${cal.slug}`)
			else invalidateAll()
		},
	}))

	const creating = $derived(createCalendarMutation.isPending)

	function createCalendar() {
		if (!newCalendarName.trim()) return
		createCalendarMutation.mutate()
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
			<div class="bg-raised p-5 flex flex-col justify-center space-y-3">
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
				<a href="/Calendar:{primary.slug}" class="inline-block mt-1 text-sm text-link font-medium transition-colors hover:text-link-hover">View full page →</a>
			</div>
		</div>
	{/if}

	{#if calendars.length > 0}
		<h2 class="text-sm font-semibold text-heading uppercase tracking-wider mb-3">All Calendars</h2>
		<div class="space-y-1.5">
			{#each calendars as cal (cal.id)}
				<a href="/Calendar:{cal.slug}" class="
					flex items-center justify-between px-4 py-3 bg-raised
					transition-colors group
 hover:bg-surface
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
		<div class="mt-8 bg-raised p-5 space-y-3">
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
		<div class="mt-8 bg-raised p-5">
			<p class="text-sm text-secondary">Admin role required to create calendars.</p>
		</div>
	{/if}
</ArticleShell>
