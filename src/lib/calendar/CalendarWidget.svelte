<script lang="ts">
	import { untrack } from 'svelte'
	import type { CalendarConfig } from './types.js'
	import { getMonthGrid, resolveDisplay, moonPhase, phaseName, daysInMonth, formatYearWithEra, seasonForDate } from './date-math.js'

	let {
		config,
		year: initialYear,
		monthIndex: initialMonth,
	}: {
		config: CalendarConfig
		year?: number
		monthIndex?: number
	} = $props()

	type ViewMode = 'month' | 'year' | 'seasons'

	const resolved = $derived(resolveDisplay(config))
	let viewYear = $state(untrack(() => initialYear ?? resolved.year))
	let viewMonth = $state(untrack(() => initialMonth ?? resolved.month_index))
	let viewMode = $state<ViewMode>('month')
	let jumpYear = $state('')
	let showJump = $state(false)

	function previousMonth() {
		viewMonth--
		if (viewMonth < 0) {
			viewMonth = config.static_data.months.length - 1
			viewYear--
		}
		// Skip months with 0 days (intercalary that don't appear)
		while (daysInMonth(config.static_data, viewYear, viewMonth) === 0 && viewMonth > 0) {
			viewMonth--
		}
	}

	function nextMonth() {
		viewMonth++
		if (viewMonth >= config.static_data.months.length) {
			viewMonth = 0
			viewYear++
		}
		// Skip months with 0 days
		while (
			daysInMonth(config.static_data, viewYear, viewMonth) === 0 &&
			viewMonth < config.static_data.months.length - 1
		) {
			viewMonth++
		}
	}

	function goToToday() {
		viewYear = resolved.year
		viewMonth = resolved.month_index
		viewMode = 'month'
	}

	function jumpToYear(e: SubmitEvent) {
		e.preventDefault()
		const y = Number.parseInt(jumpYear)
		if (!Number.isNaN(y)) {
			viewYear = y
			showJump = false
			jumpYear = ''
		}
	}

	function selectMiniMonth(monthIndex: number) {
		viewMonth = monthIndex
		viewMode = 'month'
	}

	// Reactive grid
	let grid = $derived(getMonthGrid(config, viewYear, viewMonth))
	let isCurrentMonth = $derived(viewYear === resolved.year && viewMonth === resolved.month_index)

	function getMoonPhases(day: number) {
		if (!config.static_data.display_moons) return []
		return config.static_data.moons.map((moon) => {
			const phase = moonPhase(moon, config.static_data, {
				year: viewYear,
				month: viewMonth + 1,
				day,
			})
			return {
				name: moon.name,
				phase,
				phase_name: phaseName(phase),
				face_color: moon.face_color,
				shadow_color: moon.shadow_color,
			}
		})
	}

	/** SVG moon phase icon */
	function moonPhaseKey(phase: number): string {
		// Simplified: return a circle descriptor for CSS-based rendering
		// phase 0 = new (all shadow), 0.5 = full (all face)
		const p = ((phase % 1) + 1) % 1
		if (p < 0.0625 || p >= 0.9375) return 'new'
		if (p < 0.1875) return 'waxing-crescent'
		if (p < 0.3125) return 'first-quarter'
		if (p < 0.4375) return 'waxing-gibbous'
		if (p < 0.5625) return 'full'
		if (p < 0.6875) return 'waning-gibbous'
		if (p < 0.8125) return 'last-quarter'
		return 'waning-crescent'
	}

	const MOON_EMOJI: Record<string, string> = {
		'new': '🌑',
		'waxing-crescent': '🌒',
		'first-quarter': '🌓',
		'waxing-gibbous': '🌔',
		'full': '🌕',
		'waning-gibbous': '🌖',
		'last-quarter': '🌗',
		'waning-crescent': '🌘',
	}

	function getSeasonColor(day: number, monthIdx: number): string | null {
		const season = seasonForDate(config.static_data, { year: viewYear, month: monthIdx + 1, day })
		return season?.color ?? null
	}

	// Year view: generate mini-grids for all months
	let yearGrids = $derived(
		config.static_data.months.map((_, i) => {
			const days = daysInMonth(config.static_data, viewYear, i)
			if (days === 0) return null
			return getMonthGrid(config, viewYear, i)
		}),
	)

	// Season view: build a list of seasons with their date ranges for the current year
	let seasonBlocks = $derived.by(() => {
		const seasons = config.static_data.seasons
		if (seasons.length === 0) return []

		const blocks: Array<{
			name: string
			kind: string
			color: string
			startMonth: string
			startDay: number
			endMonth: string
			endDay: number
			totalDays: number
		}> = []

		// Walk through every day of the year and group by season
		let currentSeason: string | null = null
		let blockStart: { month: number, day: number } | null = null
		let dayCount = 0

		for (let m = 0; m < config.static_data.months.length; m++) {
			const mDays = daysInMonth(config.static_data, viewYear, m)
			for (let d = 1; d <= mDays; d++) {
				const season = seasonForDate(config.static_data, { year: viewYear, month: m + 1, day: d })
				const sName = season?.name ?? 'Unknown'

				if (sName !== currentSeason) {
					// Close previous block
					if (currentSeason !== null && blockStart) {
						const prevSeason = seasons.find(s => s.name === currentSeason)
						blocks.push({
							name: currentSeason,
							kind: prevSeason?.kind ?? 'custom',
							color: prevSeason?.color ?? '#888888',
							startMonth: config.static_data.months[blockStart.month]?.name ?? '',
							startDay: blockStart.day,
							endMonth: config.static_data.months[m]?.name ?? '',
							endDay: d - 1 > 0 ? d - 1 : daysInMonth(config.static_data, viewYear, m > 0 ? m - 1 : 0),
							totalDays: dayCount,
						})
					}
					currentSeason = sName
					blockStart = { month: m, day: d }
					dayCount = 1
				} else {
					dayCount++
				}
			}
		}

		// Close last block
		if (currentSeason !== null && blockStart) {
			const lastMonth = config.static_data.months.length - 1
			const lastDay = daysInMonth(config.static_data, viewYear, lastMonth)
			const prevSeason = seasons.find(s => s.name === currentSeason)
			blocks.push({
				name: currentSeason,
				kind: prevSeason?.kind ?? 'custom',
				color: prevSeason?.color ?? '#888888',
				startMonth: config.static_data.months[blockStart.month]?.name ?? '',
				startDay: blockStart.day,
				endMonth: config.static_data.months[lastMonth]?.name ?? '',
				endDay: lastDay,
				totalDays: dayCount,
			})
		}

		return blocks
	})
</script>

<div class="calendar-widget bg-surface shadow-sm overflow-hidden" class:max-w-md={viewMode === 'month'}>
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 bg-raised border-b border-border-strong">
		{#if viewMode === 'month'}
			<button onclick={previousMonth} class="text-secondary px-2 py-1 transition-colors hover:text-heading hover:bg-raised">&larr;</button>
		{:else}
			<button onclick={() => viewYear--} class="text-secondary px-2 py-1 transition-colors hover:text-heading hover:bg-raised">&larr;</button>
		{/if}

		<div class="text-center">
			{#if showJump}
				<form onsubmit={jumpToYear} class="flex items-center gap-1">
					<input
						type="number"
						bind:value={jumpYear}
						placeholder="Year"
						class="w-20 px-2 py-0.5 text-sm rounded bg-surface text-center focus:outline-none focus:ring-1 focus:ring-accent"
					/>
					<button type="submit" class="text-xs text-link hover:underline">Go</button>
					<button type="button" onclick={() => showJump = false} class="text-xs text-secondary hover:underline">Cancel</button>
				</form>
			{:else}
				{#if viewMode === 'month'}
					<div class="font-bold text-heading">{grid.monthName}</div>
				{/if}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="text-xs text-secondary cursor-pointer hover:text-link hover:underline"
					onclick={() => showJump = true}
					title="Click to jump to a year"
				>
					{formatYearWithEra(config.static_data, viewYear)}
				</div>
			{/if}
		</div>

		{#if viewMode === 'month'}
			<button onclick={nextMonth} class="text-secondary px-2 py-1 transition-colors hover:text-heading hover:bg-raised">&rarr;</button>
		{:else}
			<button onclick={() => viewYear++} class="text-secondary px-2 py-1 transition-colors hover:text-heading hover:bg-raised">&rarr;</button>
		{/if}
	</div>

	<!-- View mode tabs -->
	<div class="flex border-b border-border-strong text-xs bg-raised">
		{#each [['month', 'Month'], ['year', 'Year'], ['seasons', 'Seasons']] as [mode, label]}
			<button
				onclick={() => viewMode = mode as ViewMode}
				class="flex-1 py-2 text-center transition-colors {viewMode === mode ? 'text-accent font-semibold border-b-2 border-accent bg-surface' : 'text-secondary hover:text-body hover:bg-surface'}"
			>{label}</button>
		{/each}
	</div>

	{#if viewMode === 'month'}
		<!-- MONTH VIEW -->
		<!-- Weekday headers -->
		<div class="grid gap-px bg-border" style="grid-template-columns: repeat({grid.weekdays.length}, 1fr)">
			{#each grid.weekdays as wd}
				<div class="text-center text-[11px] font-semibold text-dim bg-raised py-2 uppercase tracking-wider">{wd}</div>
			{/each}
		</div>

		<!-- Day grid -->
		<div class="grid gap-px bg-border" style="grid-template-columns: repeat({grid.weekdays.length}, 1fr)">
			{#each grid.days as day}
				{#if day === null}
					<div class="bg-page min-h-11"></div>
				{:else}
					{@const isToday = isCurrentMonth && day === resolved.day}
					{@const moons = getMoonPhases(day)}
					{@const seasonColor = getSeasonColor(day, viewMonth)}
					<div
						class="bg-surface min-h-11 p-1.5 text-sm relative transition-colors {isToday ? 'ring-2 ring-inset ring-accent font-bold bg-accent-subtle' : 'hover:bg-raised'}"
						style={seasonColor ? `border-left: 3px solid ${seasonColor}` : ''}
					>
						<span class="{isToday ? 'text-accent' : 'text-body'}">{day}</span>
						{#if moons.length > 0}
							<div class="flex gap-0.5 mt-0.5">
								{#each moons as moon}
									<span class="text-xs leading-none" title="{moon.name}: {moon.phase_name}">
										{MOON_EMOJI[moonPhaseKey(moon.phase)] ?? '🌑'}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

	{:else if viewMode === 'year'}
		<!-- YEAR VIEW -->
		<div class="grid grid-cols-3 gap-2 p-3 md:grid-cols-4">
			{#each yearGrids as miniGrid, monthIdx}
				{#if miniGrid}
					{@const isCurrent = viewYear === resolved.year && monthIdx === resolved.month_index}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="cursor-pointer border p-1.5 transition-colors {isCurrent ? 'border-accent bg-accent-subtle' : 'border-transparent hover:border-border-strong hover:bg-raised'}"
						onclick={() => selectMiniMonth(monthIdx)}
					>
						<div class="text-xs font-semibold text-heading mb-1 text-center truncate">{miniGrid.monthName}</div>
						<div class="grid gap-px" style="grid-template-columns: repeat({miniGrid.weekdays.length}, 1fr)">
							{#each miniGrid.days as day}
								{#if day === null}
									<div class="h-2.5"></div>
								{:else}
									{@const isToday = isCurrent && day === resolved.day}
									{@const seasonColor = getSeasonColor(day, monthIdx)}
									<div
										class="h-2.5 text-center leading-xs {isToday ? 'bg-accent text-white' : ''}"
										style={!isToday && seasonColor ? `background: ${seasonColor}22` : ''}
									>
										<span class="text-[6px] {isToday ? 'text-white' : 'text-body'}">{day}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>

	{:else if viewMode === 'seasons'}
		<!-- SEASONS VIEW -->
		<div class="p-3 space-y-2">
			{#if seasonBlocks.length === 0}
				<p class="text-sm text-secondary text-center py-4">No seasons defined for this calendar.</p>
			{:else}
				<!-- Season bar -->
				{@const totalDays = seasonBlocks.reduce((sum, b) => sum + b.totalDays, 0)}
				<div class="flex overflow-hidden h-6">
					{#each seasonBlocks as block}
						<div
							class="flex items-center justify-center text-[9px] font-medium text-white overflow-hidden"
							style="width: {(block.totalDays / totalDays) * 100}%; background: {block.color}"
							title="{block.name}: {block.totalDays} days"
						>
							{block.totalDays > totalDays * 0.08 ? block.name : ''}
						</div>
					{/each}
				</div>

				<!-- Season list -->
				{#each seasonBlocks as block}
					<div class="flex items-center gap-3 py-1.5 border-b border-border-subtle last:border-0">
						<div class="size-3 shrink-0" style="background: {block.color}"></div>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-heading">{block.name}</div>
							<div class="text-xs text-secondary">
								{block.startDay} {block.startMonth} — {block.endDay} {block.endMonth}
							</div>
						</div>
						<div class="text-xs text-secondary shrink-0">{block.totalDays} days</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Footer -->
	<div class="px-4 py-2.5 border-t border-border-strong bg-raised flex items-center justify-between text-xs text-secondary">
		<span>{resolved.season_name}</span>
		<button onclick={goToToday} class="text-link font-medium transition-colors hover:text-link-hover">Today</button>
		<span class="text-dim">{config.name}</span>
	</div>
</div>
