<script lang="ts">
	import type { PageData } from './$types.js'
	import RodderDetailPage from '$lib/feature/rodder/RodderDetailPage.svelte'
	import CalendarDetail from '$lib/feature/calendar/components/CalendarDetail.svelte'
	import CalendarConfigure from '$lib/feature/calendar/components/CalendarConfigure.svelte'

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

<svelte:head>
	{#if headTitle}<title>{headTitle}</title>{/if}
</svelte:head>

{#if data.namespace === 'Rodder'}
	<RodderDetailPage data={data} />
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
