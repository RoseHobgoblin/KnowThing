<script lang="ts">
	import type { ActionData, PageData } from './$types.js'
	import CelestialDetailPage from '$lib/celestial/CelestialDetailPage.svelte'
	import CalendarDetail from '$lib/components/calendar/CalendarDetail.svelte'
	import CalendarConfigure from '$lib/components/calendar/CalendarConfigure.svelte'
	import type { WikiNode } from '$lib/parser/types.js'

	let { data, form }: { data: PageData, form: ActionData } = $props()

	const headTitle = $derived.by(() => {
		if (data.namespace === 'Calendar') {
			return data.mode === 'configure'
				? `Configure ${data.calendar.name} — KnowThing`
				: `${data.calendar.name} — Calendar — KnowThing`
		}
		return null // Celestial component manages its own <svelte:head>
	})
</script>

<svelte:head>
	{#if headTitle}<title>{headTitle}</title>{/if}
</svelte:head>

{#if data.namespace === 'Celestial'}
	<CelestialDetailPage
		data={data}
		form={form ?? null}
		basePath={`/Celestial:${data.body.slug}`}
	/>
{:else if data.namespace === 'Calendar'}
	{#if data.mode === 'configure'}
		<CalendarConfigure
			calendar={data.calendar}
			config={data.config}
			wikiContent={data.wikiContent}
			contentRecordId={data.contentRecordId}
		/>
	{:else}
		<CalendarDetail
			calendar={data.calendar}
			config={data.config}
			resolved={data.resolved}
			wikiContent={data.wikiContent}
			ast={data.ast as WikiNode | null}
		/>
	{/if}
{/if}
