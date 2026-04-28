<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import WorldSvgMap from '$lib/components/worldmap/WorldSvgMap.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { worldmapRegionAssignmentsBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	type RegionRow = {
		id: number
		hexColor: string
		label: string | null
		countryId: number | null
		countrySlug: string | null
		countryName: string | null
		pageSlug: string | null
		paths: Array<{ d: string, transform: string | null }>
	}

	type KnowPage = {
		slug: string
		title: string
	}

	type SvgMedia = {
		filename: string
		mimeType: string | null
	}

	type PageDataLocal = {
		map: {
			id: number
			name: string
			slug: string
			imageFilename: string | null
			imageMimeType: string | null
			imageWidth: number | null
			imageHeight: number | null
			waterHex: string | null
			hasUploadedSource: boolean
		}
		regions: RegionRow[]
		knowPages: KnowPage[]
		svgMedia: SvgMedia[]
		assignedCount: number
		unassignedCount: number
	}

	let { data }: { data: PageDataLocal } = $props()

	let ingesting = $state(false)
	let uploading = $state(false)
	let saving = $state(false)
	let selectedSvg = $state<File | null>(null)
	let selectedSvgPreviewUrl = $state<string | null>(null)
	let selectedMediaSvg = $state('')
	let hoveredRegionId = $state<number | null>(null)

	let assignments = $state<Record<number, string>>({})

	$effect(() => {
		assignments = Object.fromEntries(data.regions.map((region) => [region.id, region.pageSlug || '']))
	})

	const knowOptions = $derived([
		{ value: 'NOTHING', label: 'NOTHING (Disable Clickability)' },
		...data.knowPages.map((page) => ({
			value: page.slug,
			label: `${page.title} (${page.slug})`,
		})),
	])

	const svgMediaOptions = $derived([
		{ value: '', label: 'Choose existing SVG from media' },
		...data.svgMedia.map((file) => ({
			value: file.filename,
			label: file.filename,
		})),
	])

	const hasSvgSource = $derived(data.map.hasUploadedSource && data.map.imageMimeType === 'image/svg+xml')
	const uploadActionLabel = $derived(hasSvgSource ? 'Replace SVG And Ingest' : 'Upload SVG And Ingest')
	const uploadHelpText = $derived(
		hasSvgSource
			? 'Replace the linked SVG source for this map, then re-ingest colors and paths.'
			: 'Upload an SVG source for this map to enable ingest.',
	)
	const currentMapImageUrl = $derived(
		data.map.imageFilename ? `/api/media/${encodeURIComponent(data.map.imageFilename)}` : null,
	)

	$effect(() => {
		if (!selectedSvg) {
			selectedSvgPreviewUrl = null
			return
		}

		const objectUrl = URL.createObjectURL(selectedSvg)
		selectedSvgPreviewUrl = objectUrl

		return () => {
			URL.revokeObjectURL(objectUrl)
		}
	})

	function setAssignment(regionId: number, pageSlug: string) {
		assignments = { ...assignments, [regionId]: pageSlug }
	}

	async function runIngest() {
		ingesting = true
		try {
			const response = await fetch(`/api/maps/${data.map.slug}/ingest`, { method: 'POST' })
			if (!response.ok) {
				const body = await response.json().catch(() => ({}))
				throw new Error(body.error || 'Failed to ingest map SVG')
			}
			const result = await response.json()
			pushSuccess(`Ingested ${result.uniqueColorCount} colors. ${result.createdCountries} new country stubs created.`)
			await invalidateAll()
		} catch (err) {
			pushError(err instanceof Error ? err.message : 'Failed to ingest map SVG')
		} finally {
			ingesting = false
		}
	}

	async function saveAssignments() {
		const payload = data.regions
			.map((region) => ({
				regionId: region.id,
				pageSlug: (assignments[region.id] || '').trim(),
			}))
			.filter((entry) => entry.pageSlug.length > 0)

		if (payload.length === 0) {
			pushError('Choose at least one wiki page before saving')
			return
		}

		saving = true
		try {
			const response = await fetch(`/api/maps/${data.map.slug}/regions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ assignments: payload }),
			})
			if (!response.ok) {
				const body = await response.json().catch(() => ({}))
				throw new Error(body.error || 'Failed to save region assignments')
			}

			const result = await response.json()
			pushSuccess(`Saved ${result.updatedCount} assignment${result.updatedCount === 1 ? '' : 's'}`)
			await invalidateAll()
		} catch (err) {
			pushError(err instanceof Error ? err.message : 'Failed to save assignments')
		} finally {
			saving = false
		}
	}

	function onFileSelected(event: Event) {
		const target = event.currentTarget as HTMLInputElement
		selectedSvg = target.files?.[0] ?? null
		selectedMediaSvg = ''
	}

	function onMediaSvgSelected(value: string) {
		selectedMediaSvg = value
		selectedSvg = null
	}

	async function uploadSvgAndIngest() {
		if (!selectedSvg && !selectedMediaSvg) {
			pushError('Select an SVG file first')
			return
		}

		uploading = true
		try {
			let imageFilename = selectedMediaSvg

			if (selectedSvg) {
				if (selectedSvg.type !== 'image/svg+xml') {
					throw new Error('Only SVG files are supported for map ingest')
				}

				const formData = new FormData()
				formData.append('file', selectedSvg)
				const uploadResponse = await fetch('/api/media', {
					method: 'POST',
					body: formData,
				})

				if (!uploadResponse.ok) {
					const body = await uploadResponse.json().catch(() => ({}))
					throw new Error(body.error || 'Failed to upload map SVG')
				}

				const uploaded = await uploadResponse.json()
				imageFilename = uploaded.filename
			}

			const mapUpdateResponse = await fetch(`/api/maps/${data.map.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageFilename }),
			})

			if (!mapUpdateResponse.ok) {
				const body = await mapUpdateResponse.json().catch(() => ({}))
				throw new Error(body.error || 'Failed to link SVG to map')
			}

			pushSuccess(selectedMediaSvg ? 'Existing SVG linked to map' : 'SVG uploaded and linked to map')
			selectedSvg = null
			selectedMediaSvg = ''
			await runIngest()
		} catch (err) {
			pushError(err instanceof Error ? err.message : 'Failed to upload map SVG')
		} finally {
			uploading = false
		}
	}
</script>

<svelte:head>
	<title>{data.map.name} Region Assignments | World Map</title>
</svelte:head>

<ArticleShell
	breadcrumbs={worldmapRegionAssignmentsBreadcrumbs(data.map.name, data.map.slug)}
	title={`Assign Regions: ${data.map.name}`}
>
	{#snippet actions()}
		<Button type="button" onclick={runIngest} disabled={ingesting}>
			{ingesting ? 'Ingesting SVG...' : 'Re-ingest SVG Colors'}
		</Button>
	{/snippet}

	<div class="mb-4 text-sm text-secondary">
		{#if data.map.imageFilename}
			<div class="mb-2">
				Map source: <span class="font-mono">{data.map.imageFilename}</span>
			</div>
		{/if}
		{#if currentMapImageUrl && data.map.hasUploadedSource}
			<div class="mb-3 max-w-xl border border-border bg-raised p-2">
				<p class="mb-2 text-xs text-secondary">Current source preview</p>
				<img src={currentMapImageUrl} alt="Current map source" class="h-44 w-full object-contain bg-page" />
			</div>
			{#if data.map.imageWidth && data.map.imageHeight}
				<div class="mb-3 border border-border bg-raised p-2">
					<p class="mb-2 text-xs text-secondary">Hover a row below to highlight that region's clickable border.</p>
					<WorldSvgMap
						width={data.map.imageWidth}
						height={data.map.imageHeight}
						waterHex={data.map.waterHex || '#000000'}
						imageSrc={currentMapImageUrl}
						transparentRegions={true}
						highlightRegionId={hoveredRegionId}
						regions={data.regions.map((region) => ({
							id: region.id,
							hexColor: region.hexColor,
							label: region.label || region.countryName || region.hexColor,
							countryName: region.countryName || region.hexColor,
							pageSlug: assignments[region.id] || region.pageSlug,
							paths: region.paths,
						}))}
					/>
				</div>
			{/if}
		{/if}
		<span>Total regions: {data.regions.length}</span>
		<span class="mx-2">·</span>
		<span>Assigned: {data.assignedCount}</span>
		<span class="mx-2">·</span>
		<span>Unassigned: {data.unassignedCount}</span>
	</div>

	<div class="mb-5 border border-border bg-raised p-4 space-y-3">
		<p class="text-sm text-secondary">{uploadHelpText}</p>
		<Select
			type="single"
			items={svgMediaOptions}
			value={selectedMediaSvg}
			onValueChange={onMediaSvgSelected}
			placeholder="Choose existing SVG from media"
		/>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
			<input
				type="file"
				accept="image/svg+xml"
				onchange={onFileSelected}
				class="text-sm text-secondary file:mr-3 file:px-3 file:py-1.5 file:border file:border-border file:bg-surface file:text-body"
			/>
			<Button type="button" onclick={uploadSvgAndIngest} disabled={uploading || ingesting}>
				{uploading ? 'Uploading...' : uploadActionLabel}
			</Button>
		</div>
		{#if currentMapImageUrl && data.map.hasUploadedSource}
			<p class="text-xs text-secondary">Current source stays visible above until you choose a replacement SVG.</p>
		{/if}
		{#if selectedSvgPreviewUrl}
			<div class="max-w-xl border border-border bg-raised p-2">
				<p class="mb-2 text-xs text-secondary">Selected SVG preview</p>
				<img src={selectedSvgPreviewUrl} alt="Selected SVG preview" class="h-44 w-full object-contain bg-page" />
			</div>
		{/if}
	</div>

	{#if data.regions.length === 0}
		<p class="text-secondary">No regions exist yet. Run SVG ingest to detect colors and create empty country stubs.</p>
	{:else}
		<div class="space-y-3">
			<p class="text-sm text-secondary">Assign wiki pages for each hex color below. Assigned regions stay in the list.</p>
			{#each data.regions as region (region.id)}
				<div
					class="border border-border bg-raised p-3 grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr] md:items-center"
					role="group"
					onmouseenter={() => { hoveredRegionId = region.id }}
					onmouseleave={() => { hoveredRegionId = null }}
				>
					<div class="flex items-center gap-2 text-sm">
						<span class="inline-block h-6 w-6 border border-border" style={`background-color: ${region.hexColor};`}></span>
						<span class="font-mono">{region.hexColor}</span>
						{#if region.pageSlug}
							<span class="text-xs text-secondary">Assigned to {region.pageSlug}</span>
						{/if}
					</div>
					<Select
						type="single"
						items={knowOptions}
						value={assignments[region.id] || ''}
						onValueChange={(value) => setAssignment(region.id, value)}
						placeholder="Pick a Know page"
					/>
				</div>
			{/each}
		</div>

		<div class="mt-5">
			<Button type="button" onclick={saveAssignments} disabled={saving}>
				{saving ? 'Saving...' : 'Save Assignments'}
			</Button>
		</div>
	{/if}
</ArticleShell>
