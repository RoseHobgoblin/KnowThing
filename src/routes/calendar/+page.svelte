<script lang="ts">
	import type { PageData } from './$types.js'
	import CalendarHub from '$lib/feature/calendar/components/CalendarHub.svelte'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Calendar — KnowThing</title>
</svelte:head>

<CalendarHub calendars={data.calendars} primary={data.primary} />
