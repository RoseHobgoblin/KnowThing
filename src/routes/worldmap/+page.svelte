<script lang="ts">
	import { page } from '$app/stores'
	import { invalidateAll } from '$app/navigation'
	import { normalizePermissions } from '$lib/permissions.js'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { worldmapBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { urlSlugify } from '$lib/utils/slugify.js'

	type MapListItem = {
		id: number
		name: string
		slug: string
		timePeriod: string | null
		event: string | null
		linkedPageSlug: string | null
		description: string | null
		imageWidth: number | null
		imageHeight: number | null
		updatedAt: string
		regionCount: number
	}

	type KnowPage = {
		slug: string
		title: string
	}

	let { data }: { data: { maps: MapListItem[], knowPages: KnowPage[] } } = $props()

	const permissions = $derived(normalizePermissions($page.data.permissions))
	const userRole = $derived(String($page.data.user?.role ?? '').toLowerCase())
	const isAdminFlag = $derived(Boolean($page.data.isAdmin))
	const canCreateMap = $derived(
		permissions.canManageSettings || isAdminFlag || userRole === 'admin' || userRole === 'owner',
	)

	let showCreateForm = $state(false)
	let creating = $state(false)
	let mapName = $state('')
	let mapSlug = $state('')
	let timePeriod = $state('')
	let eventName = $state('')
	let linkedPageSlug = $state('')
	let description = $state('')

	$effect(() => {
		if (!mapSlug.trim() && mapName.trim()) {
			mapSlug = urlSlugify(mapName)
		}
	})

	const linkedPageOptions = $derived([
		{ value: '', label: 'No linked page' },
		...data.knowPages.map((page_) => ({ value: page_.slug, label: `${page_.title} (${page_.slug})` })),
	])

	async function createMap() {
		if (!mapName.trim()) {
			pushError('Map name is required')
			return
		}
		if (!mapSlug.trim()) {
			pushError('Map slug is required')
			return
		}

		creating = true
		try {
			const response = await fetch('/api/maps', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: mapName.trim(),
					slug: mapSlug.trim(),
					timePeriod: timePeriod.trim() || null,
					event: eventName.trim() || null,
					linkedPageSlug: linkedPageSlug || null,
					description: description.trim(),
				}),
			})

			if (!response.ok) {
				const body = await response.json().catch(() => ({}))
				throw new Error(body.error || 'Failed to create map')
			}

			pushSuccess('Map created')
			showCreateForm = false
			mapName = ''
			mapSlug = ''
			timePeriod = ''
			eventName = ''
			linkedPageSlug = ''
			description = ''
			await invalidateAll()
		} catch (err) {
			pushError(err instanceof Error ? err.message : 'Failed to create map')
		} finally {
			creating = false
		}
	}
</script>

<svelte:head>
	<title>World Maps</title>
	<meta name="description" content="Interactive world maps generated from PNG region data." />
</svelte:head>

<ArticleShell
	breadcrumbs={worldmapBreadcrumbs()}
	title="World Maps"
>
	{#snippet actions()}
		{#if canCreateMap}
			<Button type="button" onclick={() => showCreateForm = !showCreateForm}>
				{showCreateForm ? 'Close Create Form' : 'Create Map'}
			</Button>
		{/if}
	{/snippet}

	{#if canCreateMap && showCreateForm}
		<div class="mb-5 border border-border bg-raised p-4 space-y-4">
			<p class="text-sm text-secondary">Create a map with optional timeline/event metadata and an optional wiki link.</p>
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<Input label="Map name" bind:value={mapName} placeholder="Main World Map" />
				<Input label="Map slug" bind:value={mapSlug} placeholder="main-world-map" />
				<Input label="Time period" bind:value={timePeriod} placeholder="Age of Shattered Crowns" />
				<Input label="Event" bind:value={eventName} placeholder="War of Ashen Rivers" />
			</div>
			<Select
				type="single"
				label="Linked wiki page"
				items={linkedPageOptions}
				value={linkedPageSlug}
				onValueChange={(value) => linkedPageSlug = value}
				placeholder="Select optional linked page"
			/>
			<Input label="Description" bind:value={description} placeholder="Short description for this map" />
			<div>
				<Button type="button" onclick={createMap} disabled={creating}>
					{creating ? 'Creating...' : 'Create Map'}
				</Button>
			</div>
		</div>
	{/if}

	{#if data.maps.length === 0}
		<p class="text-secondary">No maps are available yet. {canCreateMap ? 'Use Create Map to begin.' : 'Ask an admin to create one.'}</p>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each data.maps as map (map.id)}
				<li class="border border-border bg-raised p-4">
					<a class="block hover:text-link" href={`/worldmap/${map.slug}`}>
						<h2 class="text-lg font-semibold text-heading">{map.name}</h2>
					</a>
					<p class="text-xs text-secondary mt-1">{map.regionCount} regions</p>
					{#if map.imageWidth && map.imageHeight}
						<p class="text-xs text-secondary mt-1">{map.imageWidth} x {map.imageHeight}</p>
					{/if}
					{#if map.description}
						<p class="text-sm text-body mt-2">{map.description}</p>
					{/if}
					{#if map.timePeriod || map.event || map.linkedPageSlug}
						<div class="mt-2 text-xs text-secondary space-y-1">
							{#if map.timePeriod}<p>Period: {map.timePeriod}</p>{/if}
							{#if map.event}<p>Event: {map.event}</p>{/if}
							{#if map.linkedPageSlug}
								<p>
									Linked page:
									<a class="text-link hover:text-link-hover" href={`/know/${map.linkedPageSlug}`}>{map.linkedPageSlug}</a>
								</p>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</ArticleShell>
