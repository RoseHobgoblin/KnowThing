<script module lang="ts">
	let _nextId = 0
	function uid() { return ++_nextId }
</script>

<script lang="ts">
	import type { PageData } from './$types.js'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import type { CalendarConfig } from '$lib/calendar/types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Tooltip from '$lib/components/ui/Tooltip.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'

	let { data }: { data: PageData } = $props()

	const sd = data.calendar.staticData as any
	let name = $state(data.calendar.name)
	let description = $state(data.calendar.description || '')
	let isPrimary = $state(data.calendar.isPrimary)
	let planetId = $state<number | null>(data.calendar.planetId ?? null)
	let epochOffset = $state(sd.epoch_offset ?? 0)
	let firstWeekDay = $state(sd.first_week_day ?? 0)
	let yearOffset = $state(sd.year_offset ?? 0)
	let dayLengthSeconds = $state(sd.day_length_seconds ?? 86_400)
	let displayMoons = $state(sd.display_moons ?? false)

	const linkedPlanet = $derived((data.planets as any[])?.find((p: any) => p.id === planetId))

	let months = $state<Array<{ _id: number, name: string, length: number, month_type: string, short_name: string }>>(
		(sd.months || []).map((m: any) => ({ _id: uid(), name: m.name, length: m.length, month_type: m.month_type || 'regular', short_name: m.short_name || '' })),
	)
	let weekdays = $state<Array<{ _id: number, name: string, abbreviation: string }>>(
		(sd.weekdays || []).map((w: any) => ({ _id: uid(), name: w.name, abbreviation: w.abbreviation || '' })),
	)
	let eras = $state<Array<{ _id: number, name: string, start_year: number, end_year: string, format: string, reverse_numbering: boolean }>>(
		(sd.eras || []).map((e: any) => ({ _id: uid(), name: e.name, start_year: e.start_year, end_year: e.end_year?.toString() ?? '', format: e.format || '{{year}} {{era_name}}', reverse_numbering: e.reverse_numbering ?? false })),
	)
	let moons = $state<Array<{ _id: number, name: string, cycle: number, offset: number, face_color: string, shadow_color: string }>>(
		(sd.moons || []).map((m: any) => ({ _id: uid(), name: m.name, cycle: m.cycle, offset: m.offset, face_color: m.face_color || '#ffffff', shadow_color: m.shadow_color || '#000000' })),
	)
	let seasons = $state<Array<{ _id: number, name: string, kind: string, timing_type: string, month: number, day: number, duration: number, color: string }>>(
		(sd.seasons || []).map((s: any) => ({
			_id: uid(), name: s.name, kind: s.kind || 'custom',
			timing_type: s.timing?.type || 'dated',
			month: s.timing?.month ?? 0, day: s.timing?.day ?? 1,
			duration: s.timing?.duration ?? 90, color: s.color || '#888888',
		})),
	)
	let leapDays = $state<Array<{ _id: number, name: string, month_index: number, after_day: number, interval: number, ignore: string, exclusive: string, intercalary: boolean, offset: number }>>(
		(sd.leap_days || []).map((ld: any) => ({
			_id: uid(), name: ld.name || '', month_index: ld.month_index ?? 0, after_day: ld.after_day ?? 0,
			interval: ld.interval ?? 4, ignore: (ld.ignore || []).join(', '),
			exclusive: (ld.exclusive || []).join(', '), intercalary: ld.intercalary ?? false, offset: ld.offset ?? 0,
		})),
	)

	let previewConfig = $derived<CalendarConfig>({
		name, description, primary: isPrimary,
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

	let saving = $state(false)

	function buildStaticData() {
		return previewConfig.static_data
	}

	async function save() {
		saving = true
		const response = await fetch(`/api/calendar/${data.calendar.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description, isPrimary, planetId, staticData: buildStaticData() }),
		})
		if (response.ok) pushSuccess('Calendar saved')
		else pushError('Failed to save calendar')
		saving = false
	}

	const totalDaysInYear = $derived(months.reduce((sum, m) => sum + m.length, 0))
	const dayLengthHours = $derived(Math.round((dayLengthSeconds / 3600) * 100) / 100)
</script>

<svelte:head>
	<title>Edit {data.calendar.name} — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<a href="/dashboard/calendar" class="text-xs text-faint hover:text-link">← Back to calendars</a>
			<h1 class="text-xl font-bold text-heading">{name || 'Untitled Calendar'}</h1>
			<p class="text-xs text-faint mt-0.5">{totalDaysInYear} days/year · {weekdays.length}-day week · {dayLengthHours}h days</p>
		</div>
		<button onclick={save} disabled={saving} class="
			px-5 py-2 bg-accent text-surface text-sm font-medium transition-colors
			hover:bg-accent-hover
			disabled:opacity-50
		">
			{saving ? 'Saving...' : 'Save changes'}
		</button>
	</div>

	<!-- Live Preview -->
	<details class="bg-surface border border-border">
		<summary class="
			px-4 py-3 cursor-pointer text-sm font-semibold text-heading select-none transition-colors
		
			hover:bg-raised
		">
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
			<Input label="Calendar name" bind:value={name} required placeholder="e.g. Republican Calendar" />
			<Input label="Description" bind:value={description} placeholder="A short description of this calendar" />
		</div>
		<div class="flex gap-6">
			<label class="flex items-center gap-2 text-sm text-secondary cursor-pointer">
				<input type="checkbox" bind:checked={isPrimary} class="accent-accent" />
				Primary calendar
			</label>
			<label class="flex items-center gap-2 text-sm text-secondary cursor-pointer">
				<input type="checkbox" bind:checked={displayMoons} class="accent-accent" />
				Show moon phases
			</label>
		</div>
	</section>

	<!-- Planet Link -->
	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Planet Link</h2>
			<p class="text-xs text-faint mt-0.5">Link this calendar to a planet for derived physics (day length, moon cycles).</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<span class="text-xs font-medium text-secondary block mb-1">Planet</span>
				<select bind:value={planetId} class="w-full px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
					<option value={null}>None (manual configuration)</option>
					{#each data.planets as planet (planet.id)}
						<option value={planet.id}>{planet.systemName ? `${planet.systemName} / ` : ''}{planet.name}</option>
					{/each}
				</select>
			</div>
			{#if linkedPlanet}
				<div class="space-y-1 text-xs text-secondary bg-raised p-3">
					<div class="font-medium text-heading text-sm mb-1">Derived from {linkedPlanet.name}</div>
					{#if linkedPlanet.rotationPeriodS}
						<div>Day length: <span class="text-body font-medium">{Math.round((linkedPlanet.rotationPeriodS / 3600) * 100) / 100}h</span> ({linkedPlanet.rotationPeriodS}s)</div>
					{/if}
					{#if linkedPlanet.orbitalPeriodDays}
						<div>Orbital year: <span class="text-body font-medium">{linkedPlanet.orbitalPeriodDays} days</span></div>
						{@const calendarYear = months.reduce((sum, m) => sum + m.length, 0)}
						<div>Calendar year: <span class="text-body font-medium">{calendarYear} days</span>
							{#if Math.abs(calendarYear - linkedPlanet.orbitalPeriodDays) > 0.01}
								<span class="text-accent ml-1">({(linkedPlanet.orbitalPeriodDays - calendarYear) > 0 ? '+' : ''}{(linkedPlanet.orbitalPeriodDays - calendarYear).toFixed(2)} drift/year)</span>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
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
						<span class="text-faint text-xs cursor-help">ⓘ</span>
					</Tooltip>
				</div>
				<Input type="number" bind:value={epochOffset} />
			</div>
			<div>
				<div class="flex items-center gap-1 mb-1">
					<span class="text-xs font-medium text-secondary">Day Length</span>
					<Tooltip content="Real-world seconds per calendar day. Earth = 86400 (24h). Use 72000 for a 20h day." side="top">
						<span class="text-faint text-xs cursor-help">ⓘ</span>
					</Tooltip>
				</div>
				<Input type="number" bind:value={dayLengthSeconds} min={1} />
				<p class="text-[10px] text-faint mt-1">{dayLengthHours} hours</p>
			</div>
			<div>
				<div class="flex items-center gap-1 mb-1">
					<span class="text-xs font-medium text-secondary">Year Display Offset</span>
					<Tooltip content="Added to year numbers when displayed. E.g. offset 999 makes internal year 1 display as year 1000." side="top">
						<span class="text-faint text-xs cursor-help">ⓘ</span>
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
			<button onclick={() => months = [...months, { _id: uid(), name: '', length: 30, month_type: 'regular', short_name: '' }]} class="text-xs text-link font-medium hover:underline">+ Add month</button>
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
					<Select bind:value={month.month_type} items={[{ value: 'regular', label: 'Regular' }, { value: 'intercalary', label: 'Intercalary' }]} containerClass="w-28" size="sm" />
					<button onclick={() => months = months.filter((_, index_) => index_ !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
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
			<button onclick={() => weekdays = [...weekdays, { _id: uid(), name: '', abbreviation: '' }]} class="text-xs text-link font-medium hover:underline">+ Add weekday</button>
		</div>
		<div class="flex items-center gap-1 mb-1">
			<span class="text-xs font-medium text-secondary">First weekday of Year 1, Day 1</span>
			<Tooltip content="Which weekday (0-indexed) does the very first day of your calendar fall on?" side="top">
				<span class="text-faint text-xs cursor-help">ⓘ</span>
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
					<button onclick={() => weekdays = weekdays.filter((_, index_) => index_ !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
				</div>
			{/each}
		</div>
	</section>

	<!-- Leap Days -->
	<section class="bg-surface border border-border p-5 space-y-3">
		<div class="flex items-center justify-between border-b border-border-subtle pb-2">
			<h2 class="text-sm font-semibold text-heading">Leap Days</h2>
			<button onclick={() => leapDays = [...leapDays, { _id: uid(), name: '', month_index: 0, after_day: 0, interval: 4, ignore: '', exclusive: '', intercalary: false, offset: 0 }]} class="text-xs text-link font-medium hover:underline">+ Add leap day</button>
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
					<button onclick={() => leapDays = leapDays.filter((_, index_) => index_ !== index)} class="text-faint ml-2 text-sm hover:text-error">×</button>
				</div>

				<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Insert after</span>
						<select bind:value={ld.month_index} class="w-full px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
							{#each months as m, mi (mi)}
								<option value={mi}>{m.name || `Month ${mi + 1}`}</option>
							{/each}
						</select>
					</div>
					<Input type="number" label="After day #" bind:value={ld.after_day} min={0} />
					<Input type="number" label="Every N years" bind:value={ld.interval} min={1} />
					<Input type="number" label="Year offset" bind:value={ld.offset} />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<Input label="Skip years divisible by" bind:value={ld.ignore} placeholder="e.g. 100" />
					<Input label="But keep years divisible by" bind:value={ld.exclusive} placeholder="e.g. 400" />
				</div>

				<label class="flex items-center gap-2 text-xs text-secondary cursor-pointer">
					<input type="checkbox" bind:checked={ld.intercalary} class="accent-accent" />
					Intercalary — this day doesn't advance the weekday cycle
				</label>
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
			<button onclick={() => eras = [...eras, { _id: uid(), name: '', start_year: 1, end_year: '', format: '{{year}} {{era_name}}', reverse_numbering: false }]} class="text-xs text-link font-medium hover:underline">+ Add era</button>
		</div>
		{#if eras.length === 0}
			<p class="text-sm text-faint text-center py-4">No eras defined. Years will display as plain numbers.</p>
		{/if}
		{#each eras as era, index (era._id)}
			<div class="border border-border-subtle p-4 space-y-3 bg-page">
				<div class="flex items-center justify-between">
					<Input bind:value={era.name} placeholder="Era name (e.g. FA, AD)" containerClass="flex-1" class="font-medium" />
					<button onclick={() => eras = eras.filter((_, index_) => index_ !== index)} class="text-faint ml-2 text-sm hover:text-error">×</button>
				</div>
				<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
					<Input type="number" label="Starts at year" bind:value={era.start_year} />
					<Input label="Ends at year" bind:value={era.end_year} placeholder="Open-ended" />
					<div>
						<div class="flex items-center gap-1 mb-1">
							<span class="text-xs font-medium text-secondary">Display format</span>
							<Tooltip content={'Use {{year}} and {{era_name}} as placeholders. E.g. \'{{year}} {{era_name}}\' → \'42 AD\''} side="top">
								<span class="text-faint text-xs cursor-help">ⓘ</span>
							</Tooltip>
						</div>
						<Input bind:value={era.format} placeholder={'{{year}} {{era_name}}'} />
					</div>
					<label class="flex items-center gap-2 text-xs text-secondary self-end cursor-pointer">
						<input type="checkbox" bind:checked={era.reverse_numbering} class="accent-accent" />
						Count backwards
					</label>
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
			<button onclick={() => moons = [...moons, { _id: uid(), name: '', cycle: 29.5, offset: 0, face_color: '#ffffff', shadow_color: '#1c1917' }]} class="text-xs text-link font-medium hover:underline">+ Add moon</button>
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
				<button onclick={() => moons = moons.filter((_, index_) => index_ !== index)} class="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-error">×</button>
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
			<button onclick={() => seasons = [...seasons, { _id: uid(), name: '', kind: 'custom', timing_type: 'dated', month: 0, day: 1, duration: 90, color: '#888888' }]} class="text-xs text-link font-medium hover:underline">+ Add season</button>
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
						bind:value={season.kind}
						items={[{ value: 'spring', label: 'Spring' }, { value: 'summer', label: 'Summer' }, { value: 'autumn', label: 'Autumn' }, { value: 'winter', label: 'Winter' }, { value: 'custom', label: 'Custom' }]}
						containerClass="w-24"
						size="sm"
					/>
					<button onclick={() => seasons = seasons.filter((_, index_) => index_ !== index)} class="text-faint text-sm hover:text-error">×</button>
				</div>
				<div class="flex items-center gap-3">
					<Select
						bind:value={season.timing_type}
						items={[{ value: 'dated', label: 'Starts on date' }, { value: 'periodic', label: 'Rolling duration' }]}
						containerClass="w-36"
						size="sm"
					/>
					{#if season.timing_type === 'dated'}
						<div class="flex items-center gap-1">
							<span class="text-xs text-secondary">Month</span>
							<select bind:value={season.month} class="px-2 py-1.5 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent w-32">
								{#each months as m, mi (mi)}
									<option value={mi}>{m.name || `Month ${mi + 1}`}</option>
								{/each}
							</select>
						</div>
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
</div>
