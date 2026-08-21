<script lang="ts">
	import type { PageData } from './$types.js'
	import RodderDetailPage from '$lib/feature/rodder/public/ui/RodderDetailPage.svelte'
	import CalendarDetail from '$lib/feature/calendar/public/ui/CalendarDetail.svelte'
	import CalendarConfigure from '$lib/feature/calendar/public/ui/CalendarConfigure.svelte'
	import CalendarWidget from '$lib/feature/calendar/public/ui/CalendarWidget.svelte'
	import type { CalendarConfig } from 'rimecraft'
	import MediaImage from '$lib/feature/media/public/ui/MediaImage.svelte'

	let { data }: { data: PageData } = $props()

	const headTitle = $derived.by(() => {
		if (data.namespace === 'Calendar') {
			return data.mode === 'configure'
				? `Configure ${data.calendar.name} — KnowThing`
				: `${data.calendar.name} — Calendar — KnowThing`
		}
		return null // Rodder component manages its own <svelte:head>
	})
</script>

{#snippet rodderCalendar({ config, year, monthIndex }: { config: CalendarConfig, year?: number, monthIndex?: number })}
	<CalendarWidget {config} {year} {monthIndex} />
{/snippet}

<svelte:head>
	{#if headTitle}<title>{headTitle}</title>{/if}
</svelte:head>

{#if data.namespace === 'Rodder'}
	<RodderDetailPage data={data} calendarSnippet={rodderCalendar} mediaRenderer={MediaImage} />
{:else if data.namespace === 'Calendar'}
	{#if data.mode === 'configure'}
		<CalendarConfigure
			calendar={data.calendar}
			config={data.config}
		/>
	{:else}
		<CalendarDetail
			calendar={data.calendar}
			config={data.config}
			resolved={data.resolved}
		/>
	{/if}
{/if}
