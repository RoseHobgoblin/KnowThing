<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import WorldSvgMap from '$lib/components/worldmap/WorldSvgMap.svelte'
	import { worldmapDetailBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	type RegionItem = {
		id: number
		hexColor: string
		label: string
		countryName: string
		pageSlug: string | null
		paths: string[]
	}

	type MapItem = {
		id: number
		name: string
		slug: string
		description: string | null
		imageWidth: number | null
		imageHeight: number | null
		waterHex: string | null
	}

	let { data }: { data: { map: MapItem, regions: RegionItem[] } } = $props()
</script>

<svelte:head>
	<title>{data.map.name} | World Map</title>
	<meta name="description" content={data.map.description || `Interactive map for ${data.map.name}`} />
</svelte:head>

<ArticleShell
	breadcrumbs={worldmapDetailBreadcrumbs(data.map.name)}
	title={data.map.name}
>
	{#snippet actions()}
		<a class="text-link hover:text-link-hover text-sm" href={`/worldmap/${data.map.slug}/regions`}>
			Manage Region Assignments
		</a>
	{/snippet}

	{#if data.map.description}
		<p class="text-secondary mb-3">{data.map.description}</p>
	{/if}

	{#if data.map.imageWidth && data.map.imageHeight}
		<WorldSvgMap
			width={data.map.imageWidth}
			height={data.map.imageHeight}
			waterHex={data.map.waterHex || '#000000'}
			regions={data.regions}
		/>
	{:else}
		<p class="text-secondary">Map image dimensions are missing. Set image width and height to render SVG view.</p>
	{/if}
</ArticleShell>
