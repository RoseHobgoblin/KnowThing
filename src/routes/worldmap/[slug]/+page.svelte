<script lang="ts">
	import { m } from '$lib/paraglide/messages.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import WorldSvgMap from '$lib/components/worldmap/WorldSvgMap.svelte'
	import { worldmapDetailBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	type RegionItem = {
		id: number
		hexColor: string
		label: string
		countryName: string
		pageSlug: string | null
		paths: Array<{ d: string, transform: string | null }>
	}

	type MapItem = {
		id: number
		name: string
		slug: string
		imageFilename: string | null
		imageMimeType: string | null
		description: string | null
		imageWidth: number | null
		imageHeight: number | null
		waterHex: string | null
	}

	let { data }: { data: { map: MapItem, regions: RegionItem[] } } = $props()
</script>

<svelte:head>
	<title>{m.map_detail_title({ name: data.map.name })}</title>
	<meta name="description" content={data.map.description || m.map_detail_meta({ name: data.map.name })} />
</svelte:head>

<ArticleShell
	breadcrumbs={worldmapDetailBreadcrumbs(data.map.name)}
	title={data.map.name}
>
	{#snippet actions()}
		<a class="text-link hover:text-link-hover text-sm" href={`/worldmap/${data.map.slug}/regions`}>
			{m.map_manage_region_assignments()}
		</a>
	{/snippet}

	{#if data.map.description}
		<p class="text-secondary mb-3">{data.map.description}</p>
	{/if}

	{#if data.map.imageWidth && data.map.imageHeight}
		{@const sourceUrl = data.map.imageFilename ? `/api/media/${encodeURIComponent(data.map.imageFilename)}` : null}
		<WorldSvgMap
			width={data.map.imageWidth}
			height={data.map.imageHeight}
			waterHex={data.map.waterHex || '#000000'}
			imageSrc={sourceUrl}
			transparentRegions={data.map.imageMimeType === 'image/svg+xml'}
			regions={data.regions}
		/>
	{:else}
		<p class="text-secondary">{m.map_dimensions_missing()}</p>
	{/if}
</ArticleShell>
