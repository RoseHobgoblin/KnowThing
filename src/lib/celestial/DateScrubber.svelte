<script lang="ts">
	import type { CalendarConfig } from '$lib/calendar/types.js'
	import { resolveDisplay, daysInYear, absoluteDay, dateFromAbsolute } from '$lib/calendar/date-math.js'

	let {
		calendars,
		currentAbsoluteDay = $bindable(0),
	}: {
		calendars: (CalendarConfig & { id: number })[]
		currentAbsoluteDay: number
	} = $props()

	let selectedCalendarId = $state(calendars[0]?.id ?? 0)

	const selectedCalendar = $derived(calendars.find(c => c.id === selectedCalendarId) ?? calendars[0])

	const currentDate = $derived(selectedCalendar ? dateFromAbsolute(selectedCalendar.static_data, currentAbsoluteDay) : null)
	const resolved = $derived(selectedCalendar && currentDate ? resolveDisplay(selectedCalendar, currentDate) : null)
	const yearDays = $derived(selectedCalendar && currentDate ? daysInYear(selectedCalendar.static_data, currentDate.year) : 365)

	// Day within the current year (for the slider)
	const dayOfYear = $derived(() => {
		if (!selectedCalendar || !currentDate) return 0
		const yearStart = absoluteDay(selectedCalendar.static_data, { year: currentDate.year, month: 1, day: 1 })
		return currentAbsoluteDay - yearStart
	})

	function stepDay(delta: number) {
		currentAbsoluteDay += delta
	}

	function onSlider(e: Event) {
		const target = e.target as HTMLInputElement
		const dayInYear = Number(target.value)
		if (!selectedCalendar || !currentDate) return
		const yearStart = absoluteDay(selectedCalendar.static_data, { year: currentDate.year, month: 1, day: 1 })
		currentAbsoluteDay = yearStart + dayInYear
	}

	function goToNow() {
		if (!selectedCalendar) return
		const epochOffset = selectedCalendar.static_data.epoch_offset ?? 0
		const dayLengthMs = (selectedCalendar.static_data.day_length_seconds ?? 86_400) * 1000
		currentAbsoluteDay = Math.floor(Date.now() / dayLengthMs) + epochOffset
	}
</script>

<div class="flex flex-col gap-2 px-3 py-2 bg-raised border-t border-border-subtle text-xs">
	<div class="flex items-center gap-2">
		<!-- Calendar selector -->
		{#if calendars.length > 1}
			<select
				bind:value={selectedCalendarId}
				class="px-1.5 py-1 text-xs border border-border-strong bg-surface text-body outline-none"
			>
				{#each calendars as cal (cal.id)}
					<option value={cal.id}>{cal.name}</option>
				{/each}
			</select>
		{:else if calendars.length === 1}
			<span class="text-faint">{calendars[0].name}</span>
		{/if}

		<!-- Step back -->
		<button onclick={() => stepDay(-1)} class="text-secondary px-1 transition-colors hover:text-heading" title="Previous day">◀</button>

		<!-- Date display -->
		{#if resolved}
			<span class="text-body font-medium flex-1 text-center">
				{resolved.day} {resolved.month_name}, {resolved.year_display}
			</span>
		{:else}
			<span class="text-faint flex-1 text-center">Day {currentAbsoluteDay}</span>
		{/if}

		<!-- Step forward -->
		<button onclick={() => stepDay(1)} class="text-secondary px-1 transition-colors hover:text-heading" title="Next day">▶</button>

		<!-- Now button -->
		<button onclick={goToNow} class="text-link text-[10px] transition-colors hover:text-link-hover" title="Jump to current date">Now</button>
	</div>

	<!-- Year slider -->
	<input
		type="range"
		min={0}
		max={yearDays - 1}
		value={dayOfYear()}
		oninput={onSlider}
		class="w-full h-1 accent-accent cursor-pointer"
	/>
</div>
