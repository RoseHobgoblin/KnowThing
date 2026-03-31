<script module lang="ts">
	let _nextId = 0
	function uid() { return ++_nextId }

	function parseIntList(csv: string): number[] {
		if (!csv) return []
		return csv.split(',').map(s => Number.parseInt(s.trim())).filter(n => !Number.isNaN(n))
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte'
	import type { CalendarConfig, MonthType, SeasonKind, StaticCalendarData } from '$lib/calendar/types.js'
	import { enhance } from '$app/forms'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import Tooltip from '$lib/components/ui/Tooltip.svelte'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import ConfigureFooter from '$lib/components/ConfigureFooter.svelte'
	import { calendarConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import { normalizePermissions } from '$lib/permissions.js'
	import { staticDataSchema } from '$lib/calendar/schema.js'
	import { summarizeZodIssues } from '$lib/utils.js'

	type DraftMonth = {
		_id: number
		name: string
		length: number
		month_type: MonthType
		short_name: string
	}

	type DraftWeekday = {
		_id: number
		name: string
		abbreviation: string
	}

	type DraftEra = {
		_id: number
		name: string
		start_year: number
		end_year: string
		format: string
		reverse_numbering: boolean
	}

	type DraftMoon = {
		_id: number
		name: string
		cycle: number
		offset: number
		face_color: string
		shadow_color: string
	}

	type DraftSeason = {
		_id: number
		name: string
		kind: SeasonKind
		timing_type: 'dated' | 'periodic'
		month_str: string
		day: number
		duration: number
		color: string
	}

	type DraftLeapDay = {
		_id: number
		name: string
		month_index_str: string
		after_day: number
		interval: number
		offset: number
		intercalary: boolean
		ignore: string
		exclusive: string
	}

	function draftMonths(staticData: StaticCalendarData): DraftMonth[] {
		return staticData.months.map(month => ({
			_id: uid(),
			name: month.name,
			length: month.length,
			month_type: month.month_type || 'regular',
			short_name: month.short_name || '',
		}))
	}

	function draftWeekdays(staticData: StaticCalendarData): DraftWeekday[] {
		return staticData.weekdays.map(weekday => ({
			_id: uid(),
			name: weekday.name,
			abbreviation: weekday.abbreviation || '',
		}))
	}

	function draftEras(staticData: StaticCalendarData): DraftEra[] {
		return staticData.eras.map(era => ({
			_id: uid(),
			name: era.name,
			start_year: era.start_year,
			end_year: era.end_year?.toString() ?? '',
			format: era.format || '{{year}} {{era_name}}',
			reverse_numbering: era.reverse_numbering,
		}))
	}

	function draftMoons(staticData: StaticCalendarData): DraftMoon[] {
		return staticData.moons.map(moon => ({
			_id: uid(),
			name: moon.name,
			cycle: moon.cycle,
			offset: moon.offset,
			face_color: moon.face_color,
			shadow_color: moon.shadow_color,
		}))
	}

	function draftSeasons(staticData: StaticCalendarData): DraftSeason[] {
		return staticData.seasons.map(season => ({
			_id: uid(),
			name: season.name,
			kind: season.kind || 'custom',
			timing_type: season.timing?.type || 'dated',
			month_str: season.timing && 'month' in season.timing ? String(season.timing.month) : '0',
			day: season.timing && 'day' in season.timing ? season.timing.day : 1,
			duration: season.timing && 'duration' in season.timing ? season.timing.duration : 90,
			color: season.color || '#888888',
		}))
	}

	function draftLeapDays(staticData: StaticCalendarData): DraftLeapDay[] {
		return staticData.leap_days.map(day => ({
			_id: uid(),
			name: day.name,
			month_index_str: String(day.month_index),
			after_day: day.after_day,
			interval: day.interval,
			offset: day.offset,
			intercalary: day.intercalary,
			ignore: day.ignore.join(', '),
			exclusive: day.exclusive.join(', '),
		}))
	}

	function emptyMonth(): DraftMonth {
		return { _id: uid(), name: '', length: 30, month_type: 'regular', short_name: '' }
	}

	function emptyWeekday(): DraftWeekday {
		return { _id: uid(), name: '', abbreviation: '' }
	}

	function emptyLeapDay(): DraftLeapDay {
		return { _id: uid(), name: '', month_index_str: '0', after_day: 0, interval: 4, ignore: '', exclusive: '', intercalary: false, offset: 0 }
	}

	function emptyEra(): DraftEra {
		return { _id: uid(), name: '', start_year: 1, end_year: '', format: '{{year}} {{era_name}}', reverse_numbering: false }
	}

	function emptyMoon(): DraftMoon {
		return { _id: uid(), name: '', cycle: 29.5, offset: 0, face_color: '#ffffff', shadow_color: '#1c1917' }
	}

	function emptySeason(): DraftSeason {
		return { _id: uid(), name: '', kind: 'custom', timing_type: 'dated', month_str: '0', day: 1, duration: 90, color: '#888888' }
	}

	let {
		calendar,
		config,
		wikiContent,
		contentRecordId,
		formError = '',
		formValidationIssues = [],
	}: {
		calendar: { id: number, slug: string, name: string, description: string | null }
		config: CalendarConfig
		wikiContent: string
		contentRecordId: number | null
		formError?: string
		formValidationIssues?: string[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	// Snapshot initial config for form state — intentionally not reactive
	const initialConfig = $state.snapshot(untrack(() => config))
	const initialWikiContent = untrack(() => wikiContent ?? '')
	const sd = initialConfig.static_data

	// ── Form state (scalars) ────────────────────────────────
	let epochOffset = $state(sd.epoch_offset)
	let firstWeekDay = $state(sd.first_week_day)
	let yearOffset = $state(sd.year_offset)
	let dayLengthSeconds = $state(sd.day_length_seconds ?? 86_400)
	let displayMoons = $state(sd.display_moons)

	// ── Form state (lists) ──────────────────────────────────
	// Each item gets a stable _id for {#each} keying.
	let months = $state<DraftMonth[]>(draftMonths(sd))

	let weekdays = $state<DraftWeekday[]>(draftWeekdays(sd))

	let eras = $state<DraftEra[]>(draftEras(sd))

	let moons = $state<DraftMoon[]>(draftMoons(sd))

	let seasons = $state<DraftSeason[]>(draftSeasons(sd))

	let leapDays = $state<DraftLeapDay[]>(draftLeapDays(sd))

	// Capture initial content for editor — intentionally not reactive
	let content = $state(initialWikiContent)
	let editSummary = $state('')
	let saving = $state(false)
	let localError = $state('')
	const initialStaticData = JSON.stringify(initialConfig.static_data)

	// ── Derived ─────────────────────────────────────────────
	const previewConfig = $derived<CalendarConfig>({
		name: calendar.name,
		description: calendar.description ?? '',
		primary: false,
		static_data: {
			first_week_day: firstWeekDay,
			display_moons: displayMoons,
			year_offset: yearOffset,
			epoch_offset: epochOffset,
			day_length_seconds: dayLengthSeconds,

			weekdays: weekdays.map(w => ({
				name: w.name,
				abbreviation: w.abbreviation || undefined,
			})),

			months: months.map(m => ({
				name: m.name,
				length: m.length,
				month_type: m.month_type,
				short_name: m.short_name || undefined,
			})),

			leap_days: leapDays.map(ld => ({
				name: ld.name,
				month_index: Number(ld.month_index_str) || 0,
				after_day: ld.after_day,
				interval: ld.interval,
				offset: ld.offset,
				intercalary: ld.intercalary,
				ignore: parseIntList(ld.ignore),
				exclusive: parseIntList(ld.exclusive),
			})),

			moons: moons.map(m => ({
				name: m.name,
				cycle: m.cycle,
				offset: m.offset,
				face_color: m.face_color,
				shadow_color: m.shadow_color,
			})),

			eras: eras.map(e => ({
				name: e.name,
				start_year: e.start_year,
				end_year: e.end_year ? Number.parseInt(e.end_year) : null,
				format: e.format,
				reverse_numbering: e.reverse_numbering,
			})),

			seasons: seasons.map(s => ({
				name: s.name,
				kind: s.kind,
				color: s.color,
				timing: s.timing_type === 'dated'
					? { type: 'dated' as const, month: Number(s.month_str) || 0, day: s.day }
					: { type: 'periodic' as const, duration: s.duration },
			})),
		},
	})

	const totalDaysInYear = $derived(months.reduce((sum, m) => sum + m.length, 0))
	const dayLengthHours = $derived(Math.round((dayLengthSeconds / 3600) * 100) / 100)
	const currentStaticData = $derived(JSON.stringify(previewConfig.static_data))
	const isDirty = $derived(currentStaticData !== initialStaticData || content !== initialWikiContent || editSummary.trim().length > 0)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	const validationIssues = $derived.by(() => {
		const parsed = staticDataSchema.safeParse(previewConfig.static_data)
		if (parsed.success) return []
		return summarizeZodIssues(parsed.error)
	})
	const allValidationIssues = $derived([...new Set([...validationIssues, ...formValidationIssues])])
	const activeError = $derived(localError || formError)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	function resetDraft() {
		epochOffset = sd.epoch_offset
		firstWeekDay = sd.first_week_day
		yearOffset = sd.year_offset
		dayLengthSeconds = sd.day_length_seconds ?? 86_400
		displayMoons = sd.display_moons
		months = draftMonths(sd)
		weekdays = draftWeekdays(sd)
		eras = draftEras(sd)
		moons = draftMoons(sd)
		seasons = draftSeasons(sd)
		leapDays = draftLeapDays(sd)
		content = initialWikiContent
		editSummary = ''
		localError = ''
	}

	function handleSubmit(event: SubmitEvent) {
		localError = ''
		if (allValidationIssues.length > 0) {
			event.preventDefault()
			localError = 'Review the calendar sections below before saving.'
		}
	}

	async function deleteCalendar() {
		const ok = await confirmDialog.confirm(
			'Delete calendar',
			`Delete "${calendar.name}" and its linked article content? This cannot be undone.`,
			'Delete Calendar',
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/calendar/${calendar.id}`, { method: 'DELETE' })
		if (!response.ok) {
			const body = await response.json().catch(() => ({}))
			pushError(body.error || 'Failed to delete calendar')
			return
		}

		pushSuccess('Calendar deleted')
		goto('/calendar')
	}
</script>

<ArticleShell
	breadcrumbs={calendarConfigureBreadcrumbs(calendar)}
	title="Configure {calendar.name}"
>
	<UnsavedChangesGuard when={isDirty && !saving} />
	<form
		method="POST"
		onsubmit={handleSubmit}
		use:enhance={() => {
			saving = true
			return async ({ update }) => {
				await update()
				saving = false
			}
		}}
		class="space-y-6"
	>
		<input type="hidden" name="calendarId" value={calendar.id} />
		<input type="hidden" name="contentRecordId" value={contentRecordId ?? ''} />
		<input type="hidden" name="staticData" value={JSON.stringify(previewConfig.static_data)} />
		<input type="hidden" name="content" value={content} />

		<div class="flex items-center justify-between gap-3 bg-surface border border-border px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-heading">Configure Record</h2>
				<p class="text-xs text-faint">Structured calendar settings and article content are saved together on this screen.</p>
			</div>
			<SaveStatusBadge dirty={isDirty} {saving} error={activeError} />
		</div>

		{#if activeError}
			<FormNotice title="Calendar changes were not saved" message={activeError} />
		{/if}

		{#if allValidationIssues.length > 0}
			<FormNotice
				tone="warning"
				title="Calendar draft needs attention"
				messages={allValidationIssues}
			/>
		{/if}

		<!-- Preview -->
		<details class="bg-raised border border-border-subtle">
			<summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-heading select-none transition-colors hover:bg-surface">Preview</summary>
			<div class="px-4 pb-4">
				{#if months.length > 0 && weekdays.length > 0}
					<div class="max-w-md mx-auto">
						{#key JSON.stringify(previewConfig.static_data)}
							<CalendarWidget config={previewConfig} />
						{/key}
					</div>
				{:else}
					<p class="text-sm text-faint text-center py-6">Add at least one month and one weekday to see a preview.</p>
				{/if}
			</div>
		</details>

		<!-- Identity -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Identity</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div><span class="text-xs font-medium text-secondary block mb-1">Name</span><p class="text-sm text-body">{calendar.name}</p></div>
				<div><span class="text-xs font-medium text-secondary block mb-1">Description</span><p class="text-sm text-body">{calendar.description || '—'}</p></div>
			</div>
			<Checkbox bind:value={displayMoons} label="Show moon phases" />
		</section>

		<!-- Time -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading">Time Configuration</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div>
					<div class="flex items-center gap-1 mb-1">
						<span class="text-xs font-medium text-secondary">Epoch Offset</span>
						<Tooltip content="Calendar days between Unix epoch (1 Jan 1970) and Year 1 Day 1." side="top"><span class="text-faint text-xs cursor-help">i</span></Tooltip>
					</div>
					<Input type="number" bind:value={epochOffset} />
				</div>
				<div>
					<div class="flex items-center gap-1 mb-1">
						<span class="text-xs font-medium text-secondary">Day Length</span>
						<Tooltip content="Real-world seconds per calendar day. Earth = 86400." side="top"><span class="text-faint text-xs cursor-help">i</span></Tooltip>
					</div>
					<Input type="number" bind:value={dayLengthSeconds} min={1} />
					{#if dayLengthSeconds < 1}
						<p class="text-[10px] text-error mt-1">Day length must be at least one second.</p>
					{:else}
					<p class="text-[10px] text-faint mt-1">{dayLengthHours} hours</p>
					{/if}
				</div>
				<div>
					<div class="flex items-center gap-1 mb-1">
						<span class="text-xs font-medium text-secondary">Year Display Offset</span>
						<Tooltip content="Added to displayed year numbers." side="top"><span class="text-faint text-xs cursor-help">i</span></Tooltip>
					</div>
					<Input type="number" bind:value={yearOffset} />
				</div>
			</div>
		</section>

		<!-- Months -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Months</h2><p class="text-xs text-faint">{months.length} months · {totalDaysInYear} days total</p></div>
				<button type="button" onclick={() => months = [...months, emptyMonth()]} class="text-xs text-link font-medium hover:underline">+ Add month</button>
			</div>
			{#each months as month, index (month._id)}
				<div class="flex gap-2 items-center group">
					<span class="text-[10px] text-faint w-5 text-right shrink-0">{index + 1}</span>
					<Input bind:value={month.name} placeholder="Month name" containerClass="flex-1" error={!month.name.trim() ? 'Required' : ''} />
					<Input bind:value={month.short_name} placeholder="Abbr" containerClass="w-14" />
					<div class="flex items-center gap-1">
						<Input type="number" bind:value={month.length} min={1} containerClass="w-14" class="text-center" error={month.length < 1 ? 'Min 1' : ''} />
						<span class="text-[10px] text-faint">days</span>
					</div>
					<Select type="single" bind:value={month.month_type} items={[{ value: 'regular', label: 'Regular' }, { value: 'intercalary', label: 'Intercalary' }, { value: 'lunisolar_leap', label: 'Lunisolar Leap' }]} containerClass="w-32" size="sm" />
					<button type="button" onclick={() => months = months.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</section>

		<!-- Weekdays -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Weekdays</h2><p class="text-xs text-faint">{weekdays.length}-day week</p></div>
				<button type="button" onclick={() => weekdays = [...weekdays, emptyWeekday()]} class="text-xs text-link font-medium hover:underline">+ Add weekday</button>
			</div>
			<div class="flex items-center gap-1 mb-1">
				<span class="text-xs font-medium text-secondary">First weekday of Year 1, Day 1</span>
				<Input type="number" bind:value={firstWeekDay} min={0} max={weekdays.length - 1} containerClass="w-14 ml-2" class="text-center" error={firstWeekDay < 0 || firstWeekDay >= weekdays.length ? 'Invalid' : ''} />
				{#if weekdays[firstWeekDay]}<span class="text-xs text-faint">({weekdays[firstWeekDay].name || '...'})</span>{/if}
			</div>
			{#each weekdays as day, index (day._id)}
				<div class="flex gap-2 items-center group">
					<span class="text-[10px] text-faint w-5 text-right shrink-0">{index}</span>
					<Input bind:value={day.name} placeholder="Weekday name" containerClass="flex-1" error={!day.name.trim() ? 'Required' : ''} />
					<Input bind:value={day.abbreviation} placeholder="Abbr" containerClass="w-16" />
					<button type="button" onclick={() => weekdays = weekdays.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</section>

		<!-- Leap Days -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<h2 class="text-sm font-semibold text-heading">Leap Days</h2>
				<button type="button" onclick={() => leapDays = [...leapDays, emptyLeapDay()]} class="text-xs text-link font-medium hover:underline">+ Add leap day</button>
			</div>
			{#each leapDays as ld, index (ld._id)}
				<div class="border border-border-subtle p-4 space-y-3 bg-page">
					<div class="flex items-center justify-between">
						<Input bind:value={ld.name} placeholder="Leap day name" containerClass="flex-1" class="font-medium" error={!ld.name.trim() ? 'Required' : ''} />
						<button type="button" onclick={() => leapDays = leapDays.filter((_, i) => i !== index)} class="text-faint ml-2 text-sm hover:text-error">×</button>
					</div>
					<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
						<Select type="single" label="Insert after" bind:value={ld.month_index_str} items={months.map((m, mi) => ({ value: String(mi), label: m.name || `Month ${mi + 1}` }))} />
						<Input type="number" label="After day #" bind:value={ld.after_day} min={0} />
						<Input type="number" label="Every N years" bind:value={ld.interval} min={1} />
						<Input type="number" label="Year offset" bind:value={ld.offset} />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<Input label="Skip years divisible by" bind:value={ld.ignore} placeholder="e.g. 100" />
						<Input label="But keep years divisible by" bind:value={ld.exclusive} placeholder="e.g. 400" />
					</div>
					<Checkbox bind:value={ld.intercalary} label="Intercalary — doesn't advance the weekday cycle" />
				</div>
			{/each}
		</section>

		<!-- Eras -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Eras</h2><p class="text-xs text-faint">Named periods of time</p></div>
				<button type="button" onclick={() => eras = [...eras, emptyEra()]} class="text-xs text-link font-medium hover:underline">+ Add era</button>
			</div>
			{#each eras as era, index (era._id)}
				<div class="border border-border-subtle p-4 space-y-3 bg-page">
					<div class="flex items-center justify-between">
						<Input bind:value={era.name} placeholder="Era name (e.g. FA, AD)" containerClass="flex-1" class="font-medium" error={!era.name.trim() ? 'Required' : ''} />
						<button type="button" onclick={() => eras = eras.filter((_, i) => i !== index)} class="text-faint ml-2 text-sm hover:text-error">×</button>
					</div>
					<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
						<Input type="number" label="Starts at year" bind:value={era.start_year} />
						<Input label="Ends at year" bind:value={era.end_year} placeholder="Open-ended" />
						<Input label="Display format" bind:value={era.format} placeholder={'{{year}} {{era_name}}'} />
						<Checkbox bind:value={era.reverse_numbering} label="Count backwards" />
					</div>
				</div>
			{/each}
		</section>

		<!-- Moons -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Moons</h2><p class="text-xs text-faint">Phase calculated automatically from cycle length.</p></div>
				<button type="button" onclick={() => moons = [...moons, emptyMoon()]} class="text-xs text-link font-medium hover:underline">+ Add moon</button>
			</div>
			{#each moons as moon, index (moon._id)}
				<div class="flex gap-3 items-center group border border-border-subtle p-3 bg-page">
					<div class="flex gap-1 shrink-0">
						<input type="color" bind:value={moon.face_color} class="size-7 border border-border cursor-pointer" title="Lit color" />
						<input type="color" bind:value={moon.shadow_color} class="size-7 border border-border cursor-pointer" title="Shadow color" />
					</div>
					<Input bind:value={moon.name} placeholder="Moon name" containerClass="flex-1" error={!moon.name.trim() ? 'Required' : ''} />
					<div class="flex items-center gap-1">
						<Input type="number" bind:value={moon.cycle} step="0.01" containerClass="w-20" class="text-center" />
						<span class="text-[10px] text-faint whitespace-nowrap">day cycle</span>
					</div>
					<div class="flex items-center gap-1">
						<Input type="number" bind:value={moon.offset} containerClass="w-16" class="text-center" />
						<span class="text-[10px] text-faint">offset</span>
					</div>
					<button type="button" onclick={() => moons = moons.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</section>

		<!-- Seasons -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Seasons</h2><p class="text-xs text-faint">By date or rolling duration.</p></div>
				<button type="button" onclick={() => seasons = [...seasons, emptySeason()]} class="text-xs text-link font-medium hover:underline">+ Add season</button>
			</div>
			{#each seasons as season, index (season._id)}
				<div class="border border-border-subtle p-4 space-y-3 bg-page">
					<div class="flex items-center gap-3">
						<input type="color" bind:value={season.color} class="size-7 border border-border cursor-pointer shrink-0" />
						<Input bind:value={season.name} placeholder="Season name" containerClass="flex-1" class="font-medium" error={!season.name.trim() ? 'Required' : ''} />
						<Select type="single" bind:value={season.kind} items={[{ value: 'spring', label: 'Spring' }, { value: 'summer', label: 'Summer' }, { value: 'autumn', label: 'Autumn' }, { value: 'winter', label: 'Winter' }, { value: 'custom', label: 'Custom' }]} containerClass="w-24" size="sm" />
						<button type="button" onclick={() => seasons = seasons.filter((_, i) => i !== index)} class="text-faint text-sm hover:text-error">×</button>
					</div>
					<div class="flex items-center gap-3">
						<Select type="single" bind:value={season.timing_type} items={[{ value: 'dated', label: 'Starts on date' }, { value: 'periodic', label: 'Rolling duration' }]} containerClass="w-36" size="sm" />
						{#if season.timing_type === 'dated'}
							<Select type="single" bind:value={season.month_str} items={months.map((m, mi) => ({ value: String(mi), label: m.name || `Month ${mi + 1}` }))} containerClass="w-32" size="sm" />
							<Input type="number" bind:value={season.day} min={1} containerClass="w-14" class="text-center" />
						{:else}
							<div class="flex items-center gap-1">
								<span class="text-xs text-secondary">Lasts</span>
								<Input type="number" bind:value={season.duration} min={1} containerClass="w-16" class="text-center" error={season.duration < 1 ? 'Min 1' : ''} />
								<span class="text-xs text-faint">days</span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</section>

		<ConfigureFooter
			initialContent={wikiContent ?? ''}
			bind:content
			bind:editSummary
			cancelHref="/calendar/{calendar.slug}"
			{saving}
			dirty={isDirty}
			error={activeError}
			ondiscard={resetDraft}
			submitType="submit"
			summaryName="summary"
		/>

		{#if permissions.canManageSettings}
			<section class="border border-error-border bg-error-subtle/40 p-5 space-y-3">
				<div>
					<h2 class="text-sm font-semibold text-error">Danger Zone</h2>
					<p class="text-xs text-faint mt-1">Delete this calendar and its linked article content. This cannot be undone.</p>
				</div>
				<div>
					<button
						type="button"
						onclick={deleteCalendar}
						class="px-4 py-2 text-sm border border-error-border text-error hover:bg-error-subtle"
					>
						Delete Calendar
					</button>
				</div>
			</section>
		{/if}
	</form>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
