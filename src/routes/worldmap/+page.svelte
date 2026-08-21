<script lang="ts">
	import { page } from '$app/stores'
	import { m } from '$lib/paraglide/messages.js'
	import { invalidateAll } from '$app/navigation'
	import { normalizePermissions } from '$lib/permissions.js'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { worldmapBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { createMutation } from '@tanstack/svelte-query'
	import { requestJson as api } from '$lib/transport/json.js'

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
	const createMapMutation = createMutation(() => ({
		mutationFn: (body: Record<string, unknown>) => api('POST', '/api/maps', body),
	}))
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
		{ value: '', label: m.map_no_linked_page() },
		...data.knowPages.map(page_ => ({ value: page_.slug, label: `${page_.title} (${page_.slug})` })),
	])

	async function createMap() {
		if (!mapName.trim()) {
			pushError(m.map_name_required())
			return
		}
		if (!mapSlug.trim()) {
			pushError(m.map_slug_required())
			return
		}

		try {
			await createMapMutation.mutateAsync({
				name: mapName.trim(),
				slug: mapSlug.trim(),
				timePeriod: timePeriod.trim() || null,
				event: eventName.trim() || null,
				linkedPageSlug: linkedPageSlug || null,
				description: description.trim(),
			})

			pushSuccess(m.map_map_created())
			showCreateForm = false
			mapName = ''
			mapSlug = ''
			timePeriod = ''
			eventName = ''
			linkedPageSlug = ''
			description = ''
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.map_failed_create())
		}
	}
</script>

<svelte:head>
	<title>{m.nav_world_maps()}</title>
	<meta name="description" content={m.map_meta_description()} />
</svelte:head>

<ArticleShell
	breadcrumbs={worldmapBreadcrumbs()}
	title={m.nav_world_maps()}
>
	{#snippet actions()}
		{#if canCreateMap}
			<Button type="button" onclick={() => showCreateForm = !showCreateForm}>
				{showCreateForm ? m.map_close_create_form() : m.map_create_map()}
			</Button>
		{/if}
	{/snippet}

	{#if canCreateMap && showCreateForm}
		<div class="mb-5 bg-raised p-4 space-y-4">
			<p class="text-sm text-secondary">{m.map_create_help()}</p>
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<Input label={m.map_label_map_name()} bind:value={mapName} placeholder={m.map_ph_map_name()} />
				<Input label={m.map_label_map_slug()} bind:value={mapSlug} placeholder={m.map_ph_map_slug()} />
				<Input label={m.map_label_time_period()} bind:value={timePeriod} placeholder={m.map_ph_time_period()} />
				<Input label={m.map_label_event()} bind:value={eventName} placeholder={m.map_ph_event()} />
			</div>
			<Select
				type="single"
				label={m.map_label_linked_page()}
				items={linkedPageOptions}
				value={linkedPageSlug}
				onValueChange={value => linkedPageSlug = value}
				placeholder={m.map_ph_linked_page()}
			/>
			<Input label={m.common_description()} bind:value={description} placeholder={m.map_ph_description()} />
			<div>
				<Button type="button" onclick={createMap} disabled={createMapMutation.isPending}>
					{createMapMutation.isPending ? m.common_creating() : m.map_create_map()}
				</Button>
			</div>
		</div>
	{/if}

	{#if data.maps.length === 0}
		<p class="text-secondary">{m.map_no_maps()} {canCreateMap ? m.map_use_create() : m.map_ask_admin()}</p>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each data.maps as map (map.id)}
				<li class="bg-raised p-4">
					<a class="block hover:text-link" href={`/worldmap/${map.slug}`}>
						<h2 class="text-lg font-semibold text-heading">{map.name}</h2>
					</a>
					<p class="text-xs text-secondary mt-1">{m.map_regions_count({ count: map.regionCount })}</p>
					{#if map.imageWidth && map.imageHeight}
						<p class="text-xs text-secondary mt-1">{map.imageWidth} x {map.imageHeight}</p>
					{/if}
					{#if map.description}
						<p class="text-sm text-body mt-2">{map.description}</p>
					{/if}
					{#if map.timePeriod || map.event || map.linkedPageSlug}
						<div class="mt-2 text-xs text-secondary space-y-1">
							{#if map.timePeriod}<p>{m.map_period({ value: map.timePeriod })}</p>{/if}
							{#if map.event}<p>{m.map_event({ value: map.event })}</p>{/if}
							{#if map.linkedPageSlug}
								<p>
									{m.map_linked_page()}
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
