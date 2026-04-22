<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
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
	}

	type KnowPage = {
		slug: string
		title: string
	}

	type PageDataLocal = {
		map: {
			id: number
			name: string
			slug: string
			imageFilename: string | null
			imageMimeType: string | null
			hasUploadedSource: boolean
		}
		regions: RegionRow[]
		knowPages: KnowPage[]
		assignedCount: number
		unassignedCount: number
	}

	let { data }: { data: PageDataLocal } = $props()

	let ingesting = $state(false)
	let uploading = $state(false)
	let saving = $state(false)
	let selectedPng = $state<File | null>(null)
	let selectedPngPreviewUrl = $state<string | null>(null)

	let assignments = $state<Record<number, string>>({})

	$effect(() => {
		assignments = Object.fromEntries(data.regions.map((region) => [region.id, region.pageSlug || '']))
	})

	const knowOptions = $derived([
		{ value: '', label: 'Unassigned' },
		...data.knowPages.map((page) => ({
			value: page.slug,
			label: `${page.title} (${page.slug})`,
		})),
	])

	const unassignedRegions = $derived(data.regions.filter((region) => !(region.pageSlug && region.pageSlug.trim().length > 0)))
	const missingPngSource = $derived(!data.map.hasUploadedSource || data.map.imageMimeType !== 'image/png')
	const currentMapImageUrl = $derived(
		data.map.imageFilename ? `/api/media/${encodeURIComponent(data.map.imageFilename)}` : null,
	)

	$effect(() => {
		if (!selectedPng) {
			selectedPngPreviewUrl = null
			return
		}

		const objectUrl = URL.createObjectURL(selectedPng)
		selectedPngPreviewUrl = objectUrl

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
				throw new Error(body.error || 'Failed to ingest map PNG')
			}
			const result = await response.json()
			pushSuccess(`Ingested ${result.uniqueColorCount} colors. ${result.createdCountries} new country stubs created.`)
			await invalidateAll()
		} catch (err) {
			pushError(err instanceof Error ? err.message : 'Failed to ingest map PNG')
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
		selectedPng = target.files?.[0] ?? null
	}

	async function uploadPngAndIngest() {
		if (!selectedPng) {
			pushError('Select a PNG file first')
			return
		}

		if (selectedPng.type !== 'image/png') {
			pushError('Only PNG files are supported for map ingest')
			return
		}

		uploading = true
		try {
			const formData = new FormData()
			formData.append('file', selectedPng)
			const uploadResponse = await fetch('/api/media', {
				method: 'POST',
				body: formData,
			})

			if (!uploadResponse.ok) {
				const body = await uploadResponse.json().catch(() => ({}))
				throw new Error(body.error || 'Failed to upload map PNG')
			}

			const uploaded = await uploadResponse.json()
			const mapUpdateResponse = await fetch(`/api/maps/${data.map.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageFilename: uploaded.filename }),
			})

			if (!mapUpdateResponse.ok) {
				const body = await mapUpdateResponse.json().catch(() => ({}))
				throw new Error(body.error || 'Failed to link PNG to map')
			}

			pushSuccess('PNG uploaded and linked to map')
			selectedPng = null
			await runIngest()
		} catch (err) {
			pushError(err instanceof Error ? err.message : 'Failed to upload map PNG')
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
			{ingesting ? 'Ingesting PNG...' : 'Re-ingest PNG Colors'}
		</Button>
	{/snippet}

	<div class="mb-4 text-sm text-secondary">
		{#if data.map.imageFilename}
			<div class="mb-2">
				Map source: <span class="font-mono">{data.map.imageFilename}</span>
			</div>
		{/if}
		{#if currentMapImageUrl && data.map.hasUploadedSource && data.map.imageMimeType === 'image/png'}
			<div class="mb-3 max-w-xl border border-border bg-raised p-2">
				<p class="mb-2 text-xs text-secondary">Current source preview</p>
				<img src={currentMapImageUrl} alt="Current map source" class="h-44 w-full object-contain bg-page" />
			</div>
		{/if}
		<span>Total regions: {data.regions.length}</span>
		<span class="mx-2">·</span>
		<span>Assigned: {data.assignedCount}</span>
		<span class="mx-2">·</span>
		<span>Unassigned: {data.unassignedCount}</span>
	</div>

	{#if missingPngSource}
		<div class="mb-5 border border-border bg-raised p-4 space-y-3">
			<p class="text-sm text-secondary">
				No PNG source is linked to this map. Upload one here to enable ingest.
			</p>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<input
					type="file"
					accept="image/png"
					onchange={onFileSelected}
					class="text-sm text-secondary file:mr-3 file:px-3 file:py-1.5 file:border file:border-border file:bg-surface file:text-body"
				/>
				<Button type="button" onclick={uploadPngAndIngest} disabled={uploading || ingesting}>
					{uploading ? 'Uploading...' : 'Upload PNG And Ingest'}
				</Button>
			</div>
			{#if selectedPngPreviewUrl}
				<div class="max-w-xl border border-border bg-raised p-2">
					<p class="mb-2 text-xs text-secondary">Selected PNG preview</p>
					<img src={selectedPngPreviewUrl} alt="Selected PNG preview" class="h-44 w-full object-contain bg-page" />
				</div>
			{/if}
		</div>
	{/if}

	{#if data.regions.length === 0}
		<p class="text-secondary">No regions exist yet. Run PNG ingest to detect colors and create empty country stubs.</p>
	{:else}
		<div class="space-y-3">
			{#if unassignedRegions.length > 0}
				<p class="text-sm text-secondary">Assign wiki pages for each empty hex color below.</p>
			{/if}
			{#each unassignedRegions as region (region.id)}
				<div class="border border-border bg-raised p-3 grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr] md:items-center">
					<div class="flex items-center gap-2 text-sm">
						<span class="inline-block h-6 w-6 border border-border" style={`background-color: ${region.hexColor};`}></span>
						<span class="font-mono">{region.hexColor}</span>
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
