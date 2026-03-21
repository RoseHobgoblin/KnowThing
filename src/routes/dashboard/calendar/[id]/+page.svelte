<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'

	let { data }: { data: PageData } = $props()

	// Deep clone the static data for editing
	const sd = data.calendar.staticData as any
	let name = $state(data.calendar.name)
	let description = $state(data.calendar.description || '')
	let isPrimary = $state(data.calendar.isPrimary)
	let epochOffset = $state(sd.epoch_offset ?? 0)
	let firstWeekDay = $state(sd.first_week_day ?? 0)
	let yearOffset = $state(sd.year_offset ?? 0)
	let displayMoons = $state(sd.display_moons ?? false)

	// Editable arrays
	let months = $state<Array<{ name: string, length: number, month_type: string, short_name: string }>>(
		(sd.months || []).map((m: any) => ({ name: m.name, length: m.length, month_type: m.month_type || 'regular', short_name: m.short_name || '' })),
	)
	let weekdays = $state<Array<{ name: string, abbreviation: string }>>(
		(sd.weekdays || []).map((w: any) => ({ name: w.name, abbreviation: w.abbreviation || '' })),
	)
	let eras = $state<Array<{ name: string, start_year: number, end_year: string, format: string, reverse_numbering: boolean }>>(
		(sd.eras || []).map((e: any) => ({ name: e.name, start_year: e.start_year, end_year: e.end_year?.toString() ?? '', format: e.format || '{{year}} {{era_name}}', reverse_numbering: e.reverse_numbering ?? false })),
	)
	let moons = $state<Array<{ name: string, cycle: number, offset: number, face_color: string, shadow_color: string }>>(
		(sd.moons || []).map((m: any) => ({ name: m.name, cycle: m.cycle, offset: m.offset, face_color: m.face_color || '#ffffff', shadow_color: m.shadow_color || '#000000' })),
	)
	let seasons = $state<Array<{ name: string, kind: string, timing_type: string, month: number, day: number, duration: number, color: string }>>(
		(sd.seasons || []).map((s: any) => ({
			name: s.name, kind: s.kind || 'custom',
			timing_type: s.timing?.type || 'dated',
			month: s.timing?.month ?? 0, day: s.timing?.day ?? 1,
			duration: s.timing?.duration ?? 90, color: s.color || '#888888',
		})),
	)

	let saving = $state(false)
	let saveMessage = $state('')

	async function save() {
		saving = true
		saveMessage = ''

		const staticData = {
			first_week_day: firstWeekDay,
			weekdays: weekdays.map(w => ({ name: w.name, abbreviation: w.abbreviation || undefined })),
			months: months.map(m => ({ name: m.name, length: m.length, month_type: m.month_type, short_name: m.short_name || undefined })),
			leap_days: sd.leap_days || [], // keep existing leap days (complex to edit inline)
			moons: moons.map(m => ({ name: m.name, cycle: m.cycle, offset: m.offset, face_color: m.face_color, shadow_color: m.shadow_color })),
			eras: eras.map(e => ({ name: e.name, start_year: e.start_year, end_year: e.end_year ? Number.parseInt(e.end_year) : null, format: e.format, reverse_numbering: e.reverse_numbering })),
			seasons: seasons.map(s => ({
				name: s.name, kind: s.kind, color: s.color,
				timing: s.timing_type === 'dated' ? { type: 'dated', month: s.month, day: s.day } : { type: 'periodic', duration: s.duration },
			})),
			display_moons: displayMoons,
			year_offset: yearOffset,
			epoch_offset: epochOffset,
		}

		const res = await fetch(`/api/calendar/${data.calendar.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description, isPrimary, staticData }),
		})

		if (res.ok) {
			saveMessage = 'Saved'
			setTimeout(() => saveMessage = '', 2000)
		}
		saving = false
	}

	const inputClass = 'px-2 py-1.5 border border-border-strong rounded-md text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
	const labelClass = 'block text-xs font-medium text-secondary mb-1'
</script>

<svelte:head>
	<title>Edit {data.calendar.name} — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<a href="/dashboard/calendar" class="text-sm text-faint hover:text-link">← Calendars</a>
			<h1 class="text-xl font-bold text-heading">{name}</h1>
		</div>
		<div class="flex items-center gap-3">
			{#if saveMessage}
				<span class="text-sm text-success">{saveMessage}</span>
			{/if}
			<button onclick={save} disabled={saving} class="
				px-4 py-1.5 bg-accent text-surface text-sm rounded-md font-medium transition-colors
				hover:bg-accent-hover disabled:opacity-50
			">
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	</div>

	<!-- General -->
	<section class="bg-surface rounded-lg border border-border p-4 space-y-3">
		<h2 class="text-sm font-semibold text-heading">General</h2>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<div>
				<label class={labelClass}>Name</label>
				<input type="text" bind:value={name} class="w-full {inputClass}" />
			</div>
			<div>
				<label class={labelClass}>Description</label>
				<input type="text" bind:value={description} class="w-full {inputClass}" />
			</div>
			<div>
				<label class={labelClass}>Epoch Offset <span class="text-faint font-normal">(days from Unix epoch to year 1 day 1)</span></label>
				<input type="number" bind:value={epochOffset} class="w-full {inputClass}" />
			</div>
			<div>
				<label class={labelClass}>Year Display Offset</label>
				<input type="number" bind:value={yearOffset} class="w-full {inputClass}" />
			</div>
			<div>
				<label class={labelClass}>First Weekday Index</label>
				<input type="number" bind:value={firstWeekDay} min={0} class="w-full {inputClass}" />
			</div>
			<label class="flex items-center gap-2 text-sm text-secondary self-end">
				<input type="checkbox" bind:checked={isPrimary} class="rounded-sm" /> Primary calendar
			</label>
			<label class="flex items-center gap-2 text-sm text-secondary">
				<input type="checkbox" bind:checked={displayMoons} class="rounded-sm" /> Show moon phases
			</label>
		</div>
	</section>

	<!-- Months -->
	<section class="bg-surface rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold text-heading">Months</h2>
			<button onclick={() => months = [...months, { name: '', length: 30, month_type: 'regular', short_name: '' }]} class="text-xs text-link hover:underline">+ Add</button>
		</div>
		{#each months as month, index}
			<div class="flex gap-2 items-center">
				<span class="text-xs text-faint w-6">{index + 1}.</span>
				<input type="text" bind:value={month.name} placeholder="Name" class="flex-1 {inputClass}" />
				<input type="text" bind:value={month.short_name} placeholder="Short" class="w-16 {inputClass}" />
				<input type="number" bind:value={month.length} class="w-16 {inputClass}" title="Days" />
				<select bind:value={month.month_type} class="w-28 {inputClass}">
					<option value="regular">Regular</option>
					<option value="intercalary">Intercalary</option>
				</select>
				<button onclick={() => months = months.filter((_, idx) => idx !== index)} class="text-error text-xs">×</button>
			</div>
		{/each}
	</section>

	<!-- Weekdays -->
	<section class="bg-surface rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold text-heading">Weekdays</h2>
			<button onclick={() => weekdays = [...weekdays, { name: '', abbreviation: '' }]} class="text-xs text-link hover:underline">+ Add</button>
		</div>
		{#each weekdays as day, index}
			<div class="flex gap-2 items-center">
				<input type="text" bind:value={day.name} placeholder="Name" class="flex-1 {inputClass}" />
				<input type="text" bind:value={day.abbreviation} placeholder="Abbr" class="w-20 {inputClass}" />
				<button onclick={() => weekdays = weekdays.filter((_, idx) => idx !== index)} class="text-error text-xs">×</button>
			</div>
		{/each}
	</section>

	<!-- Eras -->
	<section class="bg-surface rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold text-heading">Eras</h2>
			<button onclick={() => eras = [...eras, { name: '', start_year: 1, end_year: '', format: '{{year}} {{era_name}}', reverse_numbering: false }]} class="text-xs text-link hover:underline">+ Add</button>
		</div>
		{#each eras as era, index}
			<div class="flex gap-2 items-center flex-wrap">
				<input type="text" bind:value={era.name} placeholder="Name" class="flex-1 min-w-[120px] {inputClass}" />
				<input type="number" bind:value={era.start_year} class="w-20 {inputClass}" title="Start year" />
				<input type="text" bind:value={era.end_year} placeholder="End" class="w-20 {inputClass}" title="End year (blank = current)" />
				<input type="text" bind:value={era.format} placeholder="Format" class="w-40 {inputClass}" title={'e.g. {{year}} {{era_name}}'} />
				<label class="flex items-center gap-1 text-xs text-faint">
					<input type="checkbox" bind:checked={era.reverse_numbering} class="rounded-sm" /> Reverse
				</label>
				<button onclick={() => eras = eras.filter((_, idx) => idx !== index)} class="text-error text-xs">×</button>
			</div>
		{/each}
	</section>

	<!-- Moons -->
	<section class="bg-surface rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold text-heading">Moons</h2>
			<button onclick={() => moons = [...moons, { name: '', cycle: 29.5, offset: 0, face_color: '#ffffff', shadow_color: '#1c1917' }]} class="text-xs text-link hover:underline">+ Add</button>
		</div>
		{#each moons as moon, index}
			<div class="flex gap-2 items-center">
				<input type="text" bind:value={moon.name} placeholder="Name" class="flex-1 {inputClass}" />
				<input type="number" bind:value={moon.cycle} step="0.1" class="w-20 {inputClass}" title="Orbital period (days)" />
				<input type="number" bind:value={moon.offset} class="w-16 {inputClass}" title="Phase offset" />
				<input type="color" bind:value={moon.face_color} class="size-8 rounded-sm border border-border cursor-pointer" title="Lit color" />
				<input type="color" bind:value={moon.shadow_color} class="size-8 rounded-sm border border-border cursor-pointer" title="Shadow color" />
				<button onclick={() => moons = moons.filter((_, idx) => idx !== index)} class="text-error text-xs">×</button>
			</div>
		{/each}
	</section>

	<!-- Seasons -->
	<section class="bg-surface rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold text-heading">Seasons</h2>
			<button onclick={() => seasons = [...seasons, { name: '', kind: 'custom', timing_type: 'dated', month: 0, day: 1, duration: 90, color: '#888888' }]} class="text-xs text-link hover:underline">+ Add</button>
		</div>
		{#each seasons as season, index}
			<div class="flex gap-2 items-center flex-wrap">
				<input type="text" bind:value={season.name} placeholder="Name" class="flex-1 min-w-[100px] {inputClass}" />
				<select bind:value={season.kind} class="w-24 {inputClass}">
					<option value="spring">Spring</option>
					<option value="summer">Summer</option>
					<option value="autumn">Autumn</option>
					<option value="winter">Winter</option>
					<option value="custom">Custom</option>
				</select>
				<select bind:value={season.timing_type} class="w-24 {inputClass}">
					<option value="dated">Dated</option>
					<option value="periodic">Periodic</option>
				</select>
				{#if season.timing_type === 'dated'}
					<input type="number" bind:value={season.month} class="w-16 {inputClass}" title="Month (0-indexed)" />
					<input type="number" bind:value={season.day} class="w-16 {inputClass}" title="Day" />
				{:else}
					<input type="number" bind:value={season.duration} class="w-20 {inputClass}" title="Duration (days)" />
				{/if}
				<input type="color" bind:value={season.color} class="size-8 rounded-sm border border-border cursor-pointer" />
				<button onclick={() => seasons = seasons.filter((_, idx) => idx !== index)} class="text-error text-xs">×</button>
			</div>
		{/each}
	</section>
</div>
