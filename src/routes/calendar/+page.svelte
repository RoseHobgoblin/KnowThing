<script lang="ts">
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import { resolveDisplay } from '$lib/calendar/date-math.js'
	import type { CalendarConfig } from '$lib/calendar/types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'

	let { data } = $props()

	let selectedCalendar: CalendarConfig | null = $state(data.primary)

	function selectCalendar(cal: CalendarConfig) {
		selectedCalendar = cal
	}
</script>

<svelte:head>
	<title>Calendar — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={[{ label: 'Calendar' }]}
	title="Calendar"
>
	{#if data.calendars.length === 0}
		<div class="bg-accent-subtle border border-accent-border p-6 text-center">
			<p class="text-accent-text font-medium">No calendars configured yet.</p>
			<p class="text-dim text-sm mt-2">
				<a href="/dashboard/calendar" class="text-link hover:text-link-hover hover:underline">Create one in the Dashboard →</a>
			</p>
		</div>
	{:else}
		{#if data.calendars.length > 1}
			<div class="flex gap-2 mb-6">
				{#each data.calendars as cal}
					<button
						onclick={() => selectCalendar(cal)}
						class="px-3 py-1.5 text-sm transition-colors
							{selectedCalendar?.name === cal.name
								? 'bg-secondary text-surface'
								: 'bg-raised text-secondary hover:bg-border'}"
					>
						{cal.name}
						{#if cal.primary}
							<span class="text-xs opacity-60">(primary)</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		{#if selectedCalendar}
			{@const resolved = resolveDisplay(selectedCalendar)}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Calendar widget -->
				<CalendarWidget
					config={selectedCalendar}
					year={data.initialYear ?? undefined}
					monthIndex={data.initialMonth != null ? data.initialMonth - 1 : undefined}
				/>

				<!-- Current date info -->
				<div class="bg-raised border border-border-subtle p-4">
					<h2 class="font-bold text-body mb-3">Current Date</h2>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-secondary">Full date</span>
							<span class="font-medium text-body">
								{resolved.day_of_week_name}, {resolved.day} {resolved.month_name}, {resolved.year_display}
							</span>
						</div>
						{#if resolved.era_name}
							<div class="flex justify-between">
								<span class="text-secondary">Era</span>
								<span class="font-medium text-body">{resolved.era_name}</span>
							</div>
						{/if}
						{#if resolved.season_name}
							<div class="flex justify-between">
								<span class="text-secondary">Season</span>
								<span class="font-medium text-body">{resolved.season_name}</span>
							</div>
						{/if}

						{#if resolved.moon_phases.length > 0}
							<div class="border-t border-border pt-2 mt-3">
								<span class="text-secondary text-xs uppercase tracking-wide">Moon Phases</span>
								{#each resolved.moon_phases as moon}
									<div class="flex justify-between mt-1">
										<span class="text-secondary">{moon.moon_name}</span>
										<span class="font-medium text-body">{moon.phase_name}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Magic word reference -->
					<div class="border-t border-border mt-4 pt-3">
						<span class="text-secondary text-xs uppercase tracking-wide">Template Magic Words</span>
						<div class="mt-2 space-y-1 text-xs font-mono">
							<div class="flex justify-between">
								<code class="text-dim">{`{{CURRENTYEAR}}`}</code>
								<span class="text-body">{resolved.year}</span>
							</div>
							<div class="flex justify-between">
								<code class="text-dim">{`{{CURRENTMONTHNAME}}`}</code>
								<span class="text-body">{resolved.month_name}</span>
							</div>
							<div class="flex justify-between">
								<code class="text-dim">{`{{CURRENTDAY}}`}</code>
								<span class="text-body">{resolved.day}</span>
							</div>
							<div class="flex justify-between">
								<code class="text-dim">{`{{CURRENTDAYNAME}}`}</code>
								<span class="text-body">{resolved.day_of_week_name}</span>
							</div>
							<div class="flex justify-between">
								<code class="text-dim">{`{{CURRENTERA}}`}</code>
								<span class="text-body">{resolved.era_name}</span>
							</div>
							<div class="flex justify-between">
								<code class="text-dim">{`{{CURRENTSEASON}}`}</code>
								<span class="text-body">{resolved.season_name}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</ArticleShell>
