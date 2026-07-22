<script lang="ts">
	import { untrack } from 'svelte'
	import type { CalendarConfig } from '$lib/calendar/types.js'
	import Select from '$lib/components/ui/Select.svelte'
	import { resolveDisplay, daysInYear, absoluteDay, dateFromAbsolute } from '$lib/calendar/date-math.js'
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
	import CaretRight from 'phosphor-svelte/lib/CaretRight'

	let {
		calendars,
		currentAbsoluteDay = $bindable(0),
	}: {
		calendars: (CalendarConfig & { id: number })[]
		currentAbsoluteDay: number
	} = $props()

	let selectedCalendarId = $state(untrack(() => calendars[0]?.id ?? 0))

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

	function onSlider(event: Event) {
		const target = event.target as HTMLInputElement
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
			<Select
				type="single"
				numeric
				bind:value={selectedCalendarId}
				items={calendars.map(cal => ({ value: String(cal.id), label: cal.name }))}
				size="sm"
			/>
		{:else if calendars.length === 1}
			<span class="text-secondary">{calendars[0].name}</span>
		{/if}

		<!-- Step back -->
		<button onclick={() => stepDay(-1)} class="text-secondary px-1 transition-colors hover:text-heading" title="Previous day"><CaretLeft size={12} weight="bold" /></button>

		<!-- Date display -->
		{#if resolved}
			<span class="text-body font-medium flex-1 text-center">
				{resolved.day} {resolved.month_name}, {resolved.year_display}
			</span>
		{:else}
			<span class="text-secondary flex-1 text-center">Day {currentAbsoluteDay}</span>
		{/if}

		<!-- Step forward -->
		<button onclick={() => stepDay(1)} class="text-secondary px-1 transition-colors hover:text-heading" title="Next day"><CaretRight size={12} weight="bold" /></button>

		<!-- Now button -->
		<button onclick={goToNow} class="text-link text-xs transition-colors hover:text-link-hover" title="Jump to current date">Now</button>
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
