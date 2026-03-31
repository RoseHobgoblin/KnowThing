<script module lang="ts">
	let _nextId = 0
	function uid() { return ++_nextId }
</script>

<script lang="ts">
	import type { PageData } from './$types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import Tooltip from '$lib/components/ui/Tooltip.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
	import Star from 'phosphor-svelte/lib/Star'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { page } from '$app/stores'
	import { invalidateAll, goto } from '$app/navigation'
	import type { CalendarConfig } from '$lib/calendar/types.js'

	let { data }: { data: PageData } = $props()

	const isAdmin = $derived($page.data.isAdmin)
	const layoutData = $derived($page.data)

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})

	// ── Hub mode state ──
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
						first_week_day: 0, weekdays: [], months: [], leap_days: [],
						moons: [], eras: [], seasons: [], display_moons: false,
						year_offset: 0, epoch_offset: 0,
					},
				}),
			})
			if (res.ok) {
				const cal = await res.json()
				pushSuccess(`Created calendar "${cal.name}"`)
				newCalendarName = ''
				await invalidateAll()
			} else {
				const body = await res.json().catch(() => ({}))
				pushError(body.error || 'Failed to create calendar')
			}
		} finally {
			creating = false
		}
	}

	// ── Configure mode state ──
	// Only initialise when in configure mode to avoid accessing undefined properties
	const sd = data.mode === 'configure' ? ((data.calendar as any)?.staticData as any ?? {}) : {}

	let months = $state<Array<{ _id: number, name: string, length: number, month_type: string, short_name: string }>>(
		data.mode === 'configure'
			? ((data.calendar as any)?.staticData as any)?.months?.map((m: any) => ({ _id: uid(), name: m.name, length: m.length, month_type: m.month_type || 'regular', short_name: m.short_name || '' })) ?? []
			: [],
	)
	let weekdays = $state<Array<{ _id: number, name: string, abbreviation: string }>>(
		data.mode === 'configure'
			? ((data.calendar as any)?.staticData as any)?.weekdays?.map((w: any) => ({ _id: uid(), name: w.name, abbreviation: w.abbreviation || '' })) ?? []
			: [],
	)
	let eras = $state<Array<{ _id: number, name: string, start_year: number, end_year: string, format: string, reverse_numbering: boolean }>>(
		data.mode === 'configure'
			? ((data.calendar as any)?.staticData as any)?.eras?.map((e: any) => ({ _id: uid(), name: e.name, start_year: e.start_year, end_year: e.end_year?.toString() ?? '', format: e.format || '{{year}} {{era_name}}', reverse_numbering: e.reverse_numbering ?? false })) ?? []
			: [],
	)
	let moons = $state<Array<{ _id: number, name: string, cycle: number, offset: number, face_color: string, shadow_color: string }>>(
		data.mode === 'configure'
			? ((data.calendar as any)?.staticData as any)?.moons?.map((m: any) => ({ _id: uid(), name: m.name, cycle: m.cycle, offset: m.offset, face_color: m.face_color || '#ffffff', shadow_color: m.shadow_color || '#000000' })) ?? []
			: [],
	)
	let seasons = $state<Array<{ _id: number, name: string, kind: string, timing_type: string, month: number, day: number, duration: number, color: string }>>(
		data.mode === 'configure'
			? ((data.calendar as any)?.staticData as any)?.seasons?.map((s: any) => ({
				_id: uid(), name: s.name, kind: s.kind || 'custom',
				timing_type: s.timing?.type || 'dated',
				month: s.timing?.month ?? 0, day: s.timing?.day ?? 1,
				duration: s.timing?.duration ?? 90, color: s.color || '#888888',
			})) ?? []
			: [],
	)
	let leapDays = $state<Array<{ _id: number, name: string, month_index: number, after_day: number, interval: number, ignore: string, exclusive: string, intercalary: boolean, offset: number }>>(
		data.mode === 'configure'
			? ((data.calendar as any)?.staticData as any)?.leap_days?.map((ld: any) => ({
				_id: uid(), name: ld.name || '', month_index: ld.month_index ?? 0, after_day: ld.after_day ?? 0,
				interval: ld.interval ?? 4, ignore: (ld.ignore || []).join(', '),
				exclusive: (ld.exclusive || []).join(', '), intercalary: ld.intercalary ?? false, offset: ld.offset ?? 0,
			})) ?? []
			: [],
	)

	let epochOffset = $state(data.mode === 'configure' ? (sd.epoch_offset ?? 0) : 0)
	let firstWeekDay = $state(data.mode === 'configure' ? (sd.first_week_day ?? 0) : 0)
	let yearOffset = $state(data.mode === 'configure' ? (sd.year_offset ?? 0) : 0)
	let dayLengthSeconds = $state(data.mode === 'configure' ? (sd.day_length_seconds ?? 86_400) : 86_400)
	let displayMoons = $state(data.mode === 'configure' ? (sd.display_moons ?? false) : false)

	let content = $state(data.mode === 'configure' ? (data.wikiContent ?? '') : '')
	let showPreview = $state(true)

	const previewConfig = $derived<CalendarConfig>({
		name: data.mode !== 'hub' ? (data.calendar as any)?.name ?? '' : '',
		description: data.mode !== 'hub' ? (data.calendar as any)?.description ?? '' : '',
		primary: data.mode !== 'hub' ? (data.calendar as any)?.isPrimary ?? false : false,
		static_data: {
			first_week_day: firstWeekDay,
			weekdays: weekdays.map(w => ({ name: w.name, abbreviation: w.abbreviation || undefined })),
			months: months.map(m => ({ name: m.name, length: m.length, month_type: m.month_type as 'regular' | 'intercalary', short_name: m.short_name || undefined })),
			leap_days: leapDays.map(ld => ({
				name: ld.name, month_index: ld.month_index, after_day: ld.after_day, interval: ld.interval,
				ignore: ld.ignore ? ld.ignore.split(',').map(s => Number.parseInt(s.trim())).filter(n => !Number.isNaN(n)) : [],
				exclusive: ld.exclusive ? ld.exclusive.split(',').map(s => Number.parseInt(s.trim())).filter(n => !Number.isNaN(n)) : [],
				intercalary: ld.intercalary, offset: ld.offset,
			})),
			moons: moons.map(m => ({ name: m.name, cycle: m.cycle, offset: m.offset, face_color: m.face_color, shadow_color: m.shadow_color })),
			eras: eras.map(e => ({ name: e.name, start_year: e.start_year, end_year: e.end_year ? Number.parseInt(e.end_year) : null, format: e.format, reverse_numbering: e.reverse_numbering })),
			seasons: seasons.map(s => ({
				name: s.name, kind: s.kind as any, color: s.color,
				timing: s.timing_type === 'dated' ? { type: 'dated' as const, month: s.month, day: s.day } : { type: 'periodic' as const, duration: s.duration },
			})),
			display_moons: displayMoons, year_offset: yearOffset, epoch_offset: epochOffset, day_length_seconds: dayLengthSeconds,
		},
	})

	const totalDaysInYear = $derived(months.reduce((sum, m) => sum + m.length, 0))
	const dayLengthHours = $derived(Math.round((dayLengthSeconds / 3600) * 100) / 100)
</script>

<svelte:head>
	{#if data.mode === 'hub'}
		<title>Calendar — KnowThing</title>
	{:else if data.mode === 'configure'}
		<title>Configure {data.calendar.name} — KnowThing</title>
	{:else}
		<title>{data.calendar.name} — Calendar — KnowThing</title>
	{/if}
</svelte:head>

{#if data.mode === 'hub'}
	<!-- ════════════════════════════ HUB MODE ════════════════════════════ -->
	<ArticleShell breadcrumbs={[{ label: 'Calendar' }]} title="Calendar">
		{#if data.primary}
			<div class="max-w-md mx-auto mb-6">
				{#key JSON.stringify(data.primary.config.static_data)}
					<CalendarWidget config={data.primary.config} />
				{/key}
			</div>
			{@const r = data.primary.config}
			<p class="text-sm text-secondary text-center mb-6">
				Primary calendar: <strong class="text-heading">{r.name}</strong>
			</p>
		{/if}

		<div class="space-y-3">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">All Calendars</h2>
			{#if data.calendars.length === 0}
				<p class="text-sm text-faint text-center py-6">No calendars yet.</p>
			{/if}
			{#each data.calendars as cal (cal.id)}
				<a href="/calendar/{cal.slug}" class="block border border-border bg-surface p-4 transition-colors hover:bg-raised">
					<div class="flex items-center gap-2">
						<CalendarBlank size={16} class="text-faint shrink-0" />
						<span class="font-medium text-heading">{cal.name}</span>
						{#if cal.isPrimary}
							<span class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent-subtle px-1.5 py-0.5">
								<Star size={10} weight="fill" /> Primary
							</span>
						{/if}
					</div>
					{#if cal.description}
						<p class="text-sm text-secondary mt-1">{cal.description}</p>
					{/if}
				</a>
			{/each}
		</div>

		{#if isAdmin}
			<div class="mt-8 border border-border bg-surface p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">New Calendar</h2>
				<div class="flex gap-2">
					<Input bind:value={newCalendarName} placeholder="Calendar name" containerClass="flex-1" />
					<button
						onclick={createCalendar}
						disabled={creating || !newCalendarName.trim()}
						class="px-5 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50"
					>
						{creating ? 'Creating...' : 'Create'}
					</button>
				</div>
			</div>
		{/if}
	</ArticleShell>

{:else if data.mode === 'detail'}
	<!-- ════════════════════════════ DETAIL MODE ════════════════════════════ -->
	<ArticleShell
		breadcrumbs={[
			{ label: 'Calendar', href: '/calendar' },
			{ label: data.calendar.name },
		]}
		title={data.calendar.name}
	>
		{#snippet actions()}
			{#if isAdmin}
				<a href="/calendar/{data.calendar.slug}/configure" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
					<GearSix size={14} weight="fill" />Configure
				</a>
			{/if}
		{/snippet}

		<!-- Calendar widget -->
		<div class="max-w-md mx-auto mb-6">
			{#key JSON.stringify(data.config.static_data)}
				<CalendarWidget config={data.config} />
			{/key}
		</div>

		<!-- Resolved date info -->
		{#if data.resolved}
			<div class="bg-raised border border-border-subtle p-4 mb-6 space-y-2">
				<h3 class="text-sm font-semibold text-heading">Current Date</h3>
				<p class="text-sm text-body">
					{data.resolved.day_of_week_name}, {data.resolved.day} {data.resolved.month_name}, {data.resolved.year_display}
				</p>
				{#if data.resolved.era_name}
					<p class="text-xs text-secondary">Era: {data.resolved.era_name}</p>
				{/if}
				{#if data.resolved.season_name}
					<p class="text-xs text-secondary">Season: {data.resolved.season_name}</p>
				{/if}
				{#if data.resolved.moon_phases.length > 0}
					<div class="flex flex-wrap gap-3 mt-1">
						{#each data.resolved.moon_phases as mp (mp.moon_name)}
							<span class="text-xs text-secondary">
								{mp.moon_name}: <span class="font-medium text-body">{mp.phase_name}</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Magic word reference -->
		<details class="bg-surface border border-border mb-6">
			<summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-heading select-none transition-colors hover:bg-raised">
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

		<!-- Wiki prose -->
		{#if data.ast}
			<article class="know-article">
				<WikiNodeComponent node={data.ast} />
			</article>
		{:else if !data.wikiContent}
			<p class="text-dim italic mt-4">No article content yet.</p>
		{/if}
	</ArticleShell>

{:else if data.mode === 'configure'}
	<!-- ════════════════════════════ CONFIGURE MODE ════════════════════════════ -->
	<ArticleShell
		breadcrumbs={[
			{ label: 'Calendar', href: '/calendar' },
			{ label: data.calendar.name, href: `/calendar/${data.calendar.slug}` },
			{ label: 'Configure' },
		]}
		title="Configure {data.calendar.name}"
	>
		<form method="POST" class="space-y-6">
			<input type="hidden" name="calendarId" value={data.calendar.id} />
			<input type="hidden" name="contentRecordId" value={data.contentRecordId ?? ''} />
			<input type="hidden" name="staticData" value={JSON.stringify(previewConfig.static_data)} />
			<input type="hidden" name="content" value={content} />

			<!-- Live Preview -->
			<details class="bg-surface border border-border" open>
				<summary class="px-4 py-3 cursor-pointer text-sm font-semibold text-heading select-none transition-colors hover:bg-raised">
					Preview
				</summary>
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
			<section class="bg-surface border border-border p-5 space-y-4">
				<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Identity</h2>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Calendar name</span>
						<p class="text-sm text-body">{data.calendar.name}</p>
					</div>
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Description</span>
						<p class="text-sm text-body">{data.calendar.description || '—'}</p>
					</div>
				</div>
				<div class="flex gap-6">
					<Checkbox bind:value={displayMoons} label="Show moon phases" />
				</div>
			</section>

			<!-- Time -->
			<section class="bg-surface border border-border p-5 space-y-4">
				<div>
					<h2 class="text-sm font-semibold text-heading">Time Configuration</h2>
					<p class="text-xs text-faint mt-0.5">How this calendar maps to real-world time.</p>
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<div class="flex items-center gap-1 mb-1">
							<span class="text-xs font-medium text-secondary">Epoch Offset</span>
							<Tooltip content="How many calendar days separate Unix epoch (1 Jan 1970) from your calendar's Year 1, Day 1. Positive = calendar starts before 1970. Negative = after." side="top">
								<span class="text-faint text-xs cursor-help">i</span>
							</Tooltip>
						</div>
						<Input type="number" bind:value={epochOffset} />
					</div>
					<div>
						<div class="flex items-center gap-1 mb-1">
							<span class="text-xs font-medium text-secondary">Day Length</span>
							<Tooltip content="Real-world seconds per calendar day. Earth = 86400 (24h). Use 72000 for a 20h day." side="top">
								<span class="text-faint text-xs cursor-help">i</span>
							</Tooltip>
						</div>
						<Input type="number" bind:value={dayLengthSeconds} min={1} />
						<p class="text-[10px] text-faint mt-1">{dayLengthHours} hours</p>
					</div>
					<div>
						<div class="flex items-center gap-1 mb-1">
							<span class="text-xs font-medium text-secondary">Year Display Offset</span>
							<Tooltip content="Added to year numbers when displayed. E.g. offset 999 makes internal year 1 display as year 1000." side="top">
								<span class="text-faint text-xs cursor-help">i</span>
							</Tooltip>
						</div>
						<Input type="number" bind:value={yearOffset} />
					</div>
				</div>
			</section>

			<!-- Months -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<div class="flex items-center justify-between border-b border-border-subtle pb-2">
					<div>
						<h2 class="text-sm font-semibold text-heading">Months</h2>
						<p class="text-xs text-faint">{months.length} months · {totalDaysInYear} days total</p>
					</div>
					<button type="button" onclick={() => months = [...months, { _id: uid(), name: '', length: 30, month_type: 'regular', short_name: '' }]} class="text-xs text-link font-medium hover:underline">+ Add month</button>
				</div>
				{#if months.length === 0}
					<p class="text-sm text-faint text-center py-4">No months defined. Add one to get started.</p>
				{/if}
				<div class="space-y-2">
					{#each months as month, index (month._id)}
						<div class="flex gap-2 items-center group">
							<span class="text-[10px] text-faint w-5 text-right shrink-0">{index + 1}</span>
							<Input bind:value={month.name} placeholder="Month name" containerClass="flex-1" />
							<Input bind:value={month.short_name} placeholder="Abbr" containerClass="w-14" />
							<div class="flex items-center gap-1">
								<Input type="number" bind:value={month.length} min={1} containerClass="w-14" class="text-center" />
								<span class="text-[10px] text-faint">days</span>
							</div>
							<Select type="single" bind:value={month.month_type} items={[{ value: 'regular', label: 'Regular' }, { value: 'intercalary', label: 'Intercalary' }]} containerClass="w-28" size="sm" />
							<button type="button" onclick={() => months = months.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">x</button>
						</div>
					{/each}
				</div>
			</section>

			<!-- Weekdays -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<div class="flex items-center justify-between border-b border-border-subtle pb-2">
					<div>
						<h2 class="text-sm font-semibold text-heading">Weekdays</h2>
						<p class="text-xs text-faint">{weekdays.length}-day week</p>
					</div>
					<button type="button" onclick={() => weekdays = [...weekdays, { _id: uid(), name: '', abbreviation: '' }]} class="text-xs text-link font-medium hover:underline">+ Add weekday</button>
				</div>
				<div class="flex items-center gap-1 mb-1">
					<span class="text-xs font-medium text-secondary">First weekday of Year 1, Day 1</span>
					<Tooltip content="Which weekday (0-indexed) does the very first day of your calendar fall on?" side="top">
						<span class="text-faint text-xs cursor-help">i</span>
					</Tooltip>
					<Input type="number" bind:value={firstWeekDay} min={0} max={weekdays.length - 1} containerClass="w-14 ml-2" class="text-center" />
					{#if weekdays[firstWeekDay]}
						<span class="text-xs text-faint">({weekdays[firstWeekDay].name || '...'})</span>
					{/if}
				</div>
				<div class="space-y-2">
					{#each weekdays as day, index (day._id)}
						<div class="flex gap-2 items-center group">
							<span class="text-[10px] text-faint w-5 text-right shrink-0">{index}</span>
							<Input bind:value={day.name} placeholder="Weekday name" containerClass="flex-1" />
							<Input bind:value={day.abbreviation} placeholder="Abbr" containerClass="w-16" />
							<button type="button" onclick={() => weekdays = weekdays.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">x</button>
						</div>
					{/each}
				</div>
			</section>

			<!-- Leap Days -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<div class="flex items-center justify-between border-b border-border-subtle pb-2">
					<h2 class="text-sm font-semibold text-heading">Leap Days</h2>
					<button type="button" onclick={() => leapDays = [...leapDays, { _id: uid(), name: '', month_index: 0, after_day: 0, interval: 4, ignore: '', exclusive: '', intercalary: false, offset: 0 }]} class="text-xs text-link font-medium hover:underline">+ Add leap day</button>
				</div>
				{#if leapDays.length === 0}
					<div class="text-center py-4">
						<p class="text-sm text-faint">No leap days defined.</p>
						<p class="text-[11px] text-faint mt-1">Example: Gregorian leap year adds a day every 4 years, except centuries, but including every 400th year.</p>
					</div>
				{/if}
				{#each leapDays as ld, index (ld._id)}
					<div class="border border-border-subtle p-4 space-y-3 bg-page">
						<div class="flex items-center justify-between">
							<Input bind:value={ld.name} placeholder="Leap day name" containerClass="flex-1" class="font-medium" />
							<button type="button" onclick={() => leapDays = leapDays.filter((_, i) => i !== index)} class="text-faint ml-2 text-sm hover:text-error">x</button>
						</div>

						<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
							<Select
								type="single"
								label="Insert after"
								numeric
								bind:value={ld.month_index}
								items={months.map((m, mi) => ({ value: String(mi), label: m.name || `Month ${mi + 1}` }))}
								containerClass="w-full"
							/>
							<Input type="number" label="After day #" bind:value={ld.after_day} min={0} />
							<Input type="number" label="Every N years" bind:value={ld.interval} min={1} />
							<Input type="number" label="Year offset" bind:value={ld.offset} />
						</div>

						<div class="grid grid-cols-2 gap-3">
							<Input label="Skip years divisible by" bind:value={ld.ignore} placeholder="e.g. 100" />
							<Input label="But keep years divisible by" bind:value={ld.exclusive} placeholder="e.g. 400" />
						</div>

						<Checkbox bind:value={ld.intercalary} label="Intercalary — this day doesn't advance the weekday cycle" />
					</div>
				{/each}
			</section>

			<!-- Eras -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<div class="flex items-center justify-between border-b border-border-subtle pb-2">
					<div>
						<h2 class="text-sm font-semibold text-heading">Eras</h2>
						<p class="text-xs text-faint">Named periods of time (e.g. BC/AD, First Age/Second Age)</p>
					</div>
					<button type="button" onclick={() => eras = [...eras, { _id: uid(), name: '', start_year: 1, end_year: '', format: '{{year}} {{era_name}}', reverse_numbering: false }]} class="text-xs text-link font-medium hover:underline">+ Add era</button>
				</div>
				{#if eras.length === 0}
					<p class="text-sm text-faint text-center py-4">No eras defined. Years will display as plain numbers.</p>
				{/if}
				{#each eras as era, index (era._id)}
					<div class="border border-border-subtle p-4 space-y-3 bg-page">
						<div class="flex items-center justify-between">
							<Input bind:value={era.name} placeholder="Era name (e.g. FA, AD)" containerClass="flex-1" class="font-medium" />
							<button type="button" onclick={() => eras = eras.filter((_, i) => i !== index)} class="text-faint ml-2 text-sm hover:text-error">x</button>
						</div>
						<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
							<Input type="number" label="Starts at year" bind:value={era.start_year} />
							<Input label="Ends at year" bind:value={era.end_year} placeholder="Open-ended" />
							<div>
								<div class="flex items-center gap-1 mb-1">
									<span class="text-xs font-medium text-secondary">Display format</span>
									<Tooltip content={'Use {{year}} and {{era_name}} as placeholders. E.g. \'{{year}} {{era_name}}\' → \'42 AD\''} side="top">
										<span class="text-faint text-xs cursor-help">i</span>
									</Tooltip>
								</div>
								<Input bind:value={era.format} placeholder={'{{year}} {{era_name}}'} />
							</div>
							<Checkbox bind:value={era.reverse_numbering} label="Count backwards" class="self-end" />
						</div>
					</div>
				{/each}
			</section>

			<!-- Moons -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<div class="flex items-center justify-between border-b border-border-subtle pb-2">
					<div>
						<h2 class="text-sm font-semibold text-heading">Moons</h2>
						<p class="text-xs text-faint">Celestial bodies with orbital cycles. Phase is calculated automatically.</p>
					</div>
					<button type="button" onclick={() => moons = [...moons, { _id: uid(), name: '', cycle: 29.5, offset: 0, face_color: '#ffffff', shadow_color: '#1c1917' }]} class="text-xs text-link font-medium hover:underline">+ Add moon</button>
				</div>
				{#if moons.length === 0}
					<p class="text-sm text-faint text-center py-4">No moons. Enable "Show moon phases" above to display them.</p>
				{/if}
				{#each moons as moon, index (moon._id)}
					<div class="flex gap-3 items-center group border border-border-subtle p-3 bg-page">
						<div class="flex gap-1 shrink-0">
							<input type="color" bind:value={moon.face_color} class="size-7 border border-border cursor-pointer" title="Lit color" />
							<input type="color" bind:value={moon.shadow_color} class="size-7 border border-border cursor-pointer" title="Shadow color" />
						</div>
						<Input bind:value={moon.name} placeholder="Moon name" containerClass="flex-1" />
						<div class="flex items-center gap-1">
							<Input type="number" bind:value={moon.cycle} step="0.01" containerClass="w-20" class="text-center" />
							<span class="text-[10px] text-faint whitespace-nowrap">day cycle</span>
						</div>
						<div class="flex items-center gap-1">
							<Input type="number" bind:value={moon.offset} containerClass="w-16" class="text-center" />
							<span class="text-[10px] text-faint">offset</span>
						</div>
						<button type="button" onclick={() => moons = moons.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">x</button>
					</div>
				{/each}
			</section>

			<!-- Seasons -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<div class="flex items-center justify-between border-b border-border-subtle pb-2">
					<div>
						<h2 class="text-sm font-semibold text-heading">Seasons</h2>
						<p class="text-xs text-faint">Define when seasons start — by date or by rolling duration.</p>
					</div>
					<button type="button" onclick={() => seasons = [...seasons, { _id: uid(), name: '', kind: 'custom', timing_type: 'dated', month: 0, day: 1, duration: 90, color: '#888888' }]} class="text-xs text-link font-medium hover:underline">+ Add season</button>
				</div>
				{#if seasons.length === 0}
					<p class="text-sm text-faint text-center py-4">No seasons defined.</p>
				{/if}
				{#each seasons as season, index (season._id)}
					<div class="border border-border-subtle p-4 space-y-3 bg-page">
						<div class="flex items-center gap-3">
							<input type="color" bind:value={season.color} class="size-7 border border-border cursor-pointer shrink-0" />
							<Input bind:value={season.name} placeholder="Season name" containerClass="flex-1" class="font-medium" />
							<Select
								type="single"
								bind:value={season.kind}
								items={[{ value: 'spring', label: 'Spring' }, { value: 'summer', label: 'Summer' }, { value: 'autumn', label: 'Autumn' }, { value: 'winter', label: 'Winter' }, { value: 'custom', label: 'Custom' }]}
								containerClass="w-24"
								size="sm"
							/>
							<button type="button" onclick={() => seasons = seasons.filter((_, i) => i !== index)} class="text-faint text-sm hover:text-error">x</button>
						</div>
						<div class="flex items-center gap-3">
							<Select
								type="single"
								bind:value={season.timing_type}
								items={[{ value: 'dated', label: 'Starts on date' }, { value: 'periodic', label: 'Rolling duration' }]}
								containerClass="w-36"
								size="sm"
							/>
							{#if season.timing_type === 'dated'}
								<Select
									type="single"
									label="Month"
									numeric
									bind:value={season.month}
									items={months.map((m, mi) => ({ value: String(mi), label: m.name || `Month ${mi + 1}` }))}
									containerClass="w-32"
									size="sm"
								/>
								<div class="flex items-center gap-1">
									<span class="text-xs text-secondary">Day</span>
									<Input type="number" bind:value={season.day} min={1} containerClass="w-14" class="text-center" />
								</div>
							{:else}
								<div class="flex items-center gap-1">
									<span class="text-xs text-secondary">Lasts</span>
									<Input type="number" bind:value={season.duration} min={1} containerClass="w-16" class="text-center" />
									<span class="text-xs text-faint">days</span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</section>

			<!-- Wiki Content Editor -->
			<section class="bg-surface border border-border p-5 space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-heading">Wiki Content</h2>
					<button
						type="button"
						onclick={() => (showPreview = !showPreview)}
						class="px-3 py-1 border border-border text-xs text-secondary hover:bg-raised {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}"
					>
						{showPreview ? 'Hide preview' : 'Show preview'}
					</button>
				</div>
				<div class="flex flex-col min-h-0 md:flex-row gap-4">
					<div class="flex-1 min-h-[300px] min-w-0 overflow-hidden border border-border">
						<Editor value={data.wikiContent ?? ''} onchange={v => (content = v)} />
					</div>
					{#if showPreview}
						<div class="flex-1 min-h-[300px] border border-border bg-surface flex flex-col min-h-0">
							<div class="bg-raised px-4 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase tracking-wide">Preview</div>
							<div class="flex-1 overflow-y-auto px-4 py-4">
								<LivePreview {content} />
							</div>
						</div>
					{/if}
				</div>
			</section>

			<!-- Submit -->
			<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
				<input
					name="summary"
					type="text"
					placeholder="Edit summary (optional)"
					class="flex-1 border border-border px-3 py-2 text-sm bg-page text-body focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border"
				/>
				<div class="flex gap-2">
					<button type="submit" class="flex-1 bg-accent text-accent-text px-5 py-2 font-medium transition-colors text-sm sm:flex-none hover:bg-accent-hover">
						Save
					</button>
					<a href="/calendar/{data.calendar.slug}" class="flex-1 text-center px-5 py-2 border border-border text-secondary text-sm sm:flex-none hover:bg-raised">
						Cancel
					</a>
				</div>
			</div>
		</form>
	</ArticleShell>
{/if}
