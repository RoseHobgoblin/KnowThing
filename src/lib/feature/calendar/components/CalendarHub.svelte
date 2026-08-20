<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { calendarPresets } from 'rimecraft'
	import CalendarWidget from './CalendarWidget.svelte'
	import { resolveDisplay } from 'rimecraft'
	import type { CalendarConfig } from 'rimecraft'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { invalidateAll, goto } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import { calendarBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

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
	type CreatedCalendar = { name: string, slug?: string }
	const createCalendarMutation = createMutation(() => ({
		mutationFn: (body: { name: string, staticData: unknown }) =>
			api<CreatedCalendar>('POST', '/api/calendar', body),
	}))

	const presetItems = [
		{ value: '', label: m.cal_preset_blank() },
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
		const preset = calendarPresets.find(p => p.label === selectedPreset)
		const staticData = preset?.staticData ?? {
			first_week_day: 0,
			weekdays: [{ name: 'Monday' }, { name: 'Tuesday' }, { name: 'Wednesday' }, { name: 'Thursday' }, { name: 'Friday' }, { name: 'Saturday' }, { name: 'Sunday' }],
			months: [{ name: 'Month 1', length: 30, month_type: 'regular' }],
			leap_days: [], moons: [], eras: [], seasons: [],
			display_moons: false, year_offset: 0, epoch_offset: 0,
		}
		try {
			const cal = await createCalendarMutation.mutateAsync({
				name: newCalendarName.trim(),
				staticData,
			})
			pushSuccess(m.cal_created({ name: cal.name }))
			newCalendarName = ''
			if (cal.slug) goto(`/Calendar:${cal.slug}`)
			else invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.cal_create_failed())
		}
	}
</script>

<svelte:head>
	<title>Calendar — KnowThing</title>
</svelte:head>

<ArticleShell breadcrumbs={calendarBreadcrumbs()} title={m.nav_calendar()}>
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
						<p class="text-sm text-secondary">{m.cal_era_label()} <span class="text-body">{resolved.era_name}</span></p>
					{/if}
					{#if resolved.season_name}
						<p class="text-sm text-secondary">{m.cal_season_label()} <span class="text-body">{resolved.season_name}</span></p>
					{/if}
				</div>
				<a href="/Calendar:{primary.slug}" class="inline-block mt-1 text-sm text-link font-medium transition-colors hover:text-link-hover">{m.cal_view_full_page()} →</a>
			</div>
		</div>
	{/if}

	{#if calendars.length > 0}
		<h2 class="text-sm font-semibold text-heading uppercase tracking-wider mb-3">{m.cal_all_calendars()}</h2>
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
		<p class="text-dim text-center py-8">{m.cal_none_configured()}</p>
	{/if}

	{#if permissions.canManageSettings}
		<div class="mt-8 bg-raised p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">{m.cal_new_calendar()}</h2>
			<Select type="single" label={m.cal_start_from_preset()} bind:value={selectedPreset} items={presetItems} />
			<div class="flex gap-2 items-end">
				<Input bind:value={newCalendarName} placeholder={m.cal_calendar_name_placeholder()} containerClass="flex-1" />
				<Button onclick={createCalendar} loading={createCalendarMutation.isPending} disabled={!newCalendarName.trim()}>
					{createCalendarMutation.isPending ? m.common_creating() : m.cal_create()}
				</Button>
			</div>
		</div>
	{:else if permissions.isAuthenticated}
		<div class="mt-8 bg-raised p-5">
			<p class="text-sm text-secondary">{m.cal_admin_required()}</p>
		</div>
	{/if}
</ArticleShell>
