<script lang="ts">
	import type { PageData } from './$types.js'
	import CalendarHub from '$lib/components/calendar/CalendarHub.svelte'
	import CalendarDetail from '$lib/components/calendar/CalendarDetail.svelte'
	import CalendarConfigure from '$lib/components/calendar/CalendarConfigure.svelte'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	{#if data.mode === 'hub'}
		<title>Calendar — KnowThing</title>
	{:else if data.mode === 'configure'}
		<title>Configure {data.calendar.name} — KnowThing</title>
	{:else}
		<title>{data.calendar.name} — Calendar — KnowThing</title>
	{/if}
</svelte:head>

{#if data.mode === 'hub'}
	<CalendarHub calendars={data.calendars} primary={data.primary} />
{:else if data.mode === 'configure'}
	<CalendarConfigure calendar={data.calendar} config={data.config} wikiContent={data.wikiContent} contentRecordId={data.contentRecordId} />
{:else}
	<CalendarDetail calendar={data.calendar} config={data.config} resolved={data.resolved} wikiContent={data.wikiContent} ast={data.ast} />
{/if}
