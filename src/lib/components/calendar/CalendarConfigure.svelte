<script module lang="ts">
	let _nextId = 0
	function uid() { return ++_nextId }

	function parseIntList(csv: string): number[] {
		if (!csv) return []
		return csv.split(',').map(s => Number.parseInt(s.trim())).filter(n => !Number.isNaN(n))
	}
</script>

<script lang="ts">
	import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import Tooltip from '$lib/components/ui/Tooltip.svelte'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import ConfigureFooter from '$lib/components/ConfigureFooter.svelte'
	import { calendarConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let {
		calendar,
		config,
		wikiContent,
		contentRecordId,
	}: {
		calendar: { id: number, slug: string, name: string, description: string | null }
		config: CalendarConfig
		wikiContent: string
		contentRecordId: number | null
	} = $props()

	// Snapshot initial config for form state — intentionally not reactive
	const sd = config.static_data

	// ── Form state (scalars) ────────────────────────────────
	let epochOffset = $state(sd.epoch_offset)
	let firstWeekDay = $state(sd.first_week_day)
	let yearOffset = $state(sd.year_offset)
	let dayLengthSeconds = $state(sd.day_length_seconds ?? 86_400)
	let displayMoons = $state(sd.display_moons)

	// ── Form state (lists) ──────────────────────────────────
	// Each item gets a stable _id for {#each} keying.
	let months = $state(sd.months.map(m => ({
		_id: uid(),
		name: m.name,
		length: m.length,
		month_type: m.month_type || 'regular',
		short_name: m.short_name || '',
	})))

	let weekdays = $state(sd.weekdays.map(w => ({
		_id: uid(),
		name: w.name,
		abbreviation: w.abbreviation || '',
	})))

	let eras = $state(sd.eras.map(era => ({
		_id: uid(),
		name: era.name,
		start_year: era.start_year,
		end_year: era.end_year?.toString() ?? '',
		format: era.format || '{{year}} {{era_name}}',
		reverse_numbering: era.reverse_numbering,
	})))

	let moons = $state(sd.moons.map(m => ({
		_id: uid(),
		name: m.name,
		cycle: m.cycle,
		offset: m.offset,
		face_color: m.face_color,
		shadow_color: m.shadow_color,
	})))

	let seasons = $state(sd.seasons.map(s => ({
		_id: uid(),
		name: s.name,
		kind: s.kind || 'custom',
		timing_type: s.timing?.type || 'dated',
		month: s.timing && 'month' in s.timing ? s.timing.month : 0,
		day: s.timing && 'day' in s.timing ? s.timing.day : 1,
		duration: s.timing && 'duration' in s.timing ? s.timing.duration : 90,
		color: s.color || '#888888',
	})))

	let leapDays = $state(sd.leap_days.map(ld => ({
		_id: uid(),
		name: ld.name,
		month_index: ld.month_index,
		after_day: ld.after_day,
		interval: ld.interval,
		offset: ld.offset,
		intercalary: ld.intercalary,
		ignore: ld.ignore.join(', '),
		exclusive: ld.exclusive.join(', '),
	})))

	// Capture initial content for editor — intentionally not reactive
	let content = $state(wikiContent ?? '')

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
				month_type: m.month_type as 'regular' | 'intercalary',
				short_name: m.short_name || undefined,
			})),

			leap_days: leapDays.map(ld => ({
				name: ld.name,
				month_index: ld.month_index,
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
				kind: s.kind as any,
				color: s.color,
				timing: s.timing_type === 'dated'
					? { type: 'dated' as const, month: s.month, day: s.day }
					: { type: 'periodic' as const, duration: s.duration },
			})),
		},
	})

	const totalDaysInYear = $derived(months.reduce((sum, m) => sum + m.length, 0))
	const dayLengthHours = $derived(Math.round((dayLengthSeconds / 3600) * 100) / 100)
</script>

<ArticleShell
	breadcrumbs={calendarConfigureBreadcrumbs(calendar)}
	title="Configure {calendar.name}"
>
	<form method="POST" class="space-y-6">
		<input type="hidden" name="calendarId" value={calendar.id} />
		<input type="hidden" name="contentRecordId" value={contentRecordId ?? ''} />
		<input type="hidden" name="staticData" value={JSON.stringify(previewConfig.static_data)} />
		<input type="hidden" name="content" value={content} />

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
					<p class="text-[10px] text-faint mt-1">{dayLengthHours} hours</p>
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
				<button type="button" onclick={() => months = [...months, { _id: uid(), name: '', length: 30, month_type: 'regular', short_name: '' }]} class="text-xs text-link font-medium hover:underline">+ Add month</button>
			</div>
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
					<button type="button" onclick={() => months = months.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</section>

		<!-- Weekdays -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Weekdays</h2><p class="text-xs text-faint">{weekdays.length}-day week</p></div>
				<button type="button" onclick={() => weekdays = [...weekdays, { _id: uid(), name: '', abbreviation: '' }]} class="text-xs text-link font-medium hover:underline">+ Add weekday</button>
			</div>
			<div class="flex items-center gap-1 mb-1">
				<span class="text-xs font-medium text-secondary">First weekday of Year 1, Day 1</span>
				<Input type="number" bind:value={firstWeekDay} min={0} max={weekdays.length - 1} containerClass="w-14 ml-2" class="text-center" />
				{#if weekdays[firstWeekDay]}<span class="text-xs text-faint">({weekdays[firstWeekDay].name || '...'})</span>{/if}
			</div>
			{#each weekdays as day, index (day._id)}
				<div class="flex gap-2 items-center group">
					<span class="text-[10px] text-faint w-5 text-right shrink-0">{index}</span>
					<Input bind:value={day.name} placeholder="Weekday name" containerClass="flex-1" />
					<Input bind:value={day.abbreviation} placeholder="Abbr" containerClass="w-16" />
					<button type="button" onclick={() => weekdays = weekdays.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</section>

		<!-- Leap Days -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<h2 class="text-sm font-semibold text-heading">Leap Days</h2>
				<button type="button" onclick={() => leapDays = [...leapDays, { _id: uid(), name: '', month_index: 0, after_day: 0, interval: 4, ignore: '', exclusive: '', intercalary: false, offset: 0 }]} class="text-xs text-link font-medium hover:underline">+ Add leap day</button>
			</div>
			{#each leapDays as ld, index (ld._id)}
				<div class="border border-border-subtle p-4 space-y-3 bg-page">
					<div class="flex items-center justify-between">
						<Input bind:value={ld.name} placeholder="Leap day name" containerClass="flex-1" class="font-medium" />
						<button type="button" onclick={() => leapDays = leapDays.filter((_, i) => i !== index)} class="text-faint ml-2 text-sm hover:text-error">×</button>
					</div>
					<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
						<Select type="single" label="Insert after" numeric bind:value={ld.month_index} items={months.map((m, mi) => ({ value: String(mi), label: m.name || `Month ${mi + 1}` }))} />
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
				<button type="button" onclick={() => eras = [...eras, { _id: uid(), name: '', start_year: 1, end_year: '', format: '{{year}} {{era_name}}', reverse_numbering: false }]} class="text-xs text-link font-medium hover:underline">+ Add era</button>
			</div>
			{#each eras as era, index (era._id)}
				<div class="border border-border-subtle p-4 space-y-3 bg-page">
					<div class="flex items-center justify-between">
						<Input bind:value={era.name} placeholder="Era name (e.g. FA, AD)" containerClass="flex-1" class="font-medium" />
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
				<button type="button" onclick={() => moons = [...moons, { _id: uid(), name: '', cycle: 29.5, offset: 0, face_color: '#ffffff', shadow_color: '#1c1917' }]} class="text-xs text-link font-medium hover:underline">+ Add moon</button>
			</div>
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
					<button type="button" onclick={() => moons = moons.filter((_, i) => i !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</section>

		<!-- Seasons -->
		<section class="bg-raised border border-border-subtle p-5 space-y-3">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div><h2 class="text-sm font-semibold text-heading">Seasons</h2><p class="text-xs text-faint">By date or rolling duration.</p></div>
				<button type="button" onclick={() => seasons = [...seasons, { _id: uid(), name: '', kind: 'custom', timing_type: 'dated', month: 0, day: 1, duration: 90, color: '#888888' }]} class="text-xs text-link font-medium hover:underline">+ Add season</button>
			</div>
			{#each seasons as season, index (season._id)}
				<div class="border border-border-subtle p-4 space-y-3 bg-page">
					<div class="flex items-center gap-3">
						<input type="color" bind:value={season.color} class="size-7 border border-border cursor-pointer shrink-0" />
						<Input bind:value={season.name} placeholder="Season name" containerClass="flex-1" class="font-medium" />
						<Select type="single" bind:value={season.kind} items={[{ value: 'spring', label: 'Spring' }, { value: 'summer', label: 'Summer' }, { value: 'autumn', label: 'Autumn' }, { value: 'winter', label: 'Winter' }, { value: 'custom', label: 'Custom' }]} containerClass="w-24" size="sm" />
						<button type="button" onclick={() => seasons = seasons.filter((_, i) => i !== index)} class="text-faint text-sm hover:text-error">×</button>
					</div>
					<div class="flex items-center gap-3">
						<Select type="single" bind:value={season.timing_type} items={[{ value: 'dated', label: 'Starts on date' }, { value: 'periodic', label: 'Rolling duration' }]} containerClass="w-36" size="sm" />
						{#if season.timing_type === 'dated'}
							<Select type="single" numeric bind:value={season.month} items={months.map((m, mi) => ({ value: String(mi), label: m.name || `Month ${mi + 1}` }))} containerClass="w-32" size="sm" />
							<Input type="number" bind:value={season.day} min={1} containerClass="w-14" class="text-center" />
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

		<ConfigureFooter
			initialContent={wikiContent ?? ''}
			bind:content
			cancelHref="/calendar/{calendar.slug}"
			submitType="submit"
			summaryName="summary"
		/>
	</form>
</ArticleShell>
