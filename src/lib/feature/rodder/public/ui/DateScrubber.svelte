<script lang="ts">
	import { untrack } from 'svelte'
	import type { CalendarConfig } from 'rimecraft'
	import Select from '$lib/components/ui/Select.svelte'
	import { resolveDisplay, daysInYear, absoluteDay, dateFromAbsolute } from 'rimecraft'
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
	import CaretRight from 'phosphor-svelte/lib/CaretRight'
	import PlayIcon from 'phosphor-svelte/lib/PlayIcon'
	import PauseIcon from 'phosphor-svelte/lib/PauseIcon'
	import { cn } from '$lib/utils.js'

	let {
		calendars,
		currentAbsoluteDay = $bindable(0),
	}: {
		calendars: (CalendarConfig & { id: number })[]
		currentAbsoluteDay: number
	} = $props()

	let selectedCalendarId = $state(untrack(() => calendars[0]?.id ?? 0))
	let playing = $state(false)
	let playSpeed = $state(30)

	const PLAY_SPEEDS = [
		{ value: '1', label: '1 d/s' },
		{ value: '7', label: '7 d/s' },
		{ value: '30', label: '30 d/s' },
		{ value: '365', label: '365 d/s' },
	]

	// Stop playback when the surrounding page swaps in a different system.
	$effect(() => {
		void calendars
		untrack(() => {
			playing = false
		})
	})

	// Orrery playback: advance in-world time by playSpeed days per real second.
	// The day stays fractional while playing so orbital motion is smooth; every
	// display site floors it before calendar math.
	$effect(() => {
		if (!playing) return
		let frame = 0
		let last = performance.now()
		const step = (now: number) => {
			const deltaSeconds = Math.min((now - last) / 1000, 0.25)
			last = now
			currentAbsoluteDay += playSpeed * deltaSeconds
			frame = requestAnimationFrame(step)
		}
		frame = requestAnimationFrame(step)
		return () => cancelAnimationFrame(frame)
	})

	const selectedCalendar = $derived(calendars.find(c => c.id === selectedCalendarId) ?? calendars[0])

	const wholeDay = $derived(Math.floor(currentAbsoluteDay))

	const currentDate = $derived(selectedCalendar ? dateFromAbsolute(selectedCalendar.static_data, wholeDay) : null)
	const resolved = $derived(selectedCalendar && currentDate ? resolveDisplay(selectedCalendar, currentDate) : null)
	const yearDays = $derived(selectedCalendar && currentDate ? daysInYear(selectedCalendar.static_data, currentDate.year) : 365)

	// Day within the current year (for the slider)
	const dayOfYear = $derived(() => {
		if (!selectedCalendar || !currentDate) return 0
		const yearStart = absoluteDay(selectedCalendar.static_data, { year: currentDate.year, month: 1, day: 1 })
		return wholeDay - yearStart
	})

	function stepDay(delta: number) {
		currentAbsoluteDay = wholeDay + delta
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
			<span class="text-secondary flex-1 text-center">Day {wholeDay}</span>
		{/if}

		<!-- Step forward -->
		<button onclick={() => stepDay(1)} class="text-secondary px-1 transition-colors hover:text-heading" title="Next day"><CaretRight size={12} weight="bold" /></button>

		<!-- Now button -->
		<button onclick={goToNow} class="text-link text-xs transition-colors hover:text-link-hover" title="Jump to current date">Now</button>

		<!-- Orrery playback -->
		<button
			onclick={() => { playing = !playing }}
			class={cn('px-1 transition-colors', playing ? 'text-accent hover:text-accent' : 'text-secondary hover:text-heading')}
			title={playing ? 'Pause' : 'Play'}
		>
			{#if playing}
				<PauseIcon size={12} weight="fill" />
			{:else}
				<PlayIcon size={12} weight="fill" />
			{/if}
		</button>
		<Select
			type="single"
			numeric
			bind:value={playSpeed}
			items={PLAY_SPEEDS}
			size="sm"
		/>
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
