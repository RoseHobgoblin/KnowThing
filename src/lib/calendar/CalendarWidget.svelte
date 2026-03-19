<script lang="ts">
	import type { CalendarConfig } from './types.js';
	import { getMonthGrid, resolveDisplay, moonPhase, phaseName, daysInMonth } from './date-math.js';

	let {
		config,
		year: initialYear,
		monthIndex: initialMonth
	}: {
		config: CalendarConfig;
		year?: number;
		monthIndex?: number;
	} = $props();

	const resolved = resolveDisplay(config);
	let viewYear = $state(initialYear ?? resolved.year);
	let viewMonth = $state(initialMonth ?? resolved.month_index);

	function prevMonth() {
		viewMonth--;
		if (viewMonth < 0) {
			viewMonth = config.static_data.months.length - 1;
			viewYear--;
		}
		// Skip months with 0 days (intercalary that don't appear)
		while (daysInMonth(config.static_data, viewYear, viewMonth) === 0 && viewMonth > 0) {
			viewMonth--;
		}
	}

	function nextMonth() {
		viewMonth++;
		if (viewMonth >= config.static_data.months.length) {
			viewMonth = 0;
			viewYear++;
		}
		// Skip months with 0 days
		while (
			daysInMonth(config.static_data, viewYear, viewMonth) === 0 &&
			viewMonth < config.static_data.months.length - 1
		) {
			viewMonth++;
		}
	}

	function goToToday() {
		viewYear = resolved.year;
		viewMonth = resolved.month_index;
	}

	// Reactive grid
	let grid = $derived(getMonthGrid(config, viewYear, viewMonth));
	let isCurrentMonth = $derived(viewYear === resolved.year && viewMonth === resolved.month_index);

	function getMoonPhases(day: number) {
		if (!config.static_data.display_moons) return [];
		return config.static_data.moons.map((moon) => {
			const phase = moonPhase(moon, config.static_data, {
				year: viewYear,
				month: viewMonth + 1,
				day
			});
			return {
				name: moon.name,
				phase,
				phase_name: phaseName(phase),
				face_color: moon.face_color,
				shadow_color: moon.shadow_color
			};
		});
	}

	/** SVG moon phase icon */
	function moonSvgPath(phase: number): string {
		// Simplified: return a circle descriptor for CSS-based rendering
		// phase 0 = new (all shadow), 0.5 = full (all face)
		const p = ((phase % 1) + 1) % 1;
		if (p < 0.0625 || p >= 0.9375) return 'new';
		if (p < 0.1875) return 'waxing-crescent';
		if (p < 0.3125) return 'first-quarter';
		if (p < 0.4375) return 'waxing-gibbous';
		if (p < 0.5625) return 'full';
		if (p < 0.6875) return 'waning-gibbous';
		if (p < 0.8125) return 'last-quarter';
		return 'waning-crescent';
	}

	const MOON_EMOJI: Record<string, string> = {
		new: '🌑',
		'waxing-crescent': '🌒',
		'first-quarter': '🌓',
		'waxing-gibbous': '🌔',
		full: '🌕',
		'waning-gibbous': '🌖',
		'last-quarter': '🌗',
		'waning-crescent': '🌘'
	};
</script>

<div class="calendar-widget bg-stone-50 border border-stone-300 rounded-lg shadow-sm max-w-md">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 bg-stone-200 rounded-t-lg border-b border-stone-300">
		<button
			onclick={prevMonth}
			class="text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-300 transition-colors"
		>
			&larr;
		</button>
		<div class="text-center">
			<div class="font-bold text-stone-800">{grid.monthName}</div>
			<div class="text-xs text-stone-600">
				{config.static_data.eras.length > 0
					? (() => {
							const era = config.static_data.eras.find(
								(e) => viewYear >= e.start_year && (e.end_year == null || viewYear <= e.end_year)
							);
							if (!era) return `Year ${viewYear}`;
							const display = era.reverse_numbering && era.end_year != null
								? era.end_year - viewYear + 1
								: viewYear - era.start_year + 1;
							return (era.format ?? '{{year}} {{era_name}}')
								.replace('{{year}}', String(display))
								.replace('{{era_name}}', era.name);
						})()
					: `Year ${viewYear}`}
			</div>
		</div>
		<button
			onclick={nextMonth}
			class="text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-300 transition-colors"
		>
			&rarr;
		</button>
	</div>

	<!-- Weekday headers -->
	<div class="grid gap-px bg-stone-200" style="grid-template-columns: repeat({grid.weekdays.length}, 1fr)">
		{#each grid.weekdays as wd}
			<div class="text-center text-xs font-semibold text-stone-600 bg-stone-100 py-1.5">
				{wd}
			</div>
		{/each}
	</div>

	<!-- Day grid -->
	<div class="grid gap-px bg-stone-200" style="grid-template-columns: repeat({grid.weekdays.length}, 1fr)">
		{#each grid.days as day}
			{#if day === null}
				<div class="bg-stone-50 min-h-[2.5rem]"></div>
			{:else}
				{@const isToday = isCurrentMonth && day === resolved.day}
				{@const moons = getMoonPhases(day)}
				<div
					class="bg-white min-h-[2.5rem] p-1 text-sm relative
						{isToday ? 'ring-2 ring-amber-500 bg-amber-50 font-bold' : 'hover:bg-stone-50'}"
				>
					<span class="text-stone-800">{day}</span>
					{#if moons.length > 0}
						<div class="flex gap-0.5 mt-0.5">
							{#each moons as moon}
								<span
									class="text-[10px] leading-none"
									title="{moon.name}: {moon.phase_name}"
								>
									{MOON_EMOJI[moonSvgPath(moon.phase)] ?? '🌑'}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<!-- Footer -->
	<div class="px-4 py-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
		<span>{resolved.season_name}</span>
		{#if !isCurrentMonth || resolved.day !== undefined}
			<button
				onclick={goToToday}
				class="text-amber-700 hover:underline"
			>
				Today
			</button>
		{/if}
		<span>{config.name}</span>
	</div>
</div>
