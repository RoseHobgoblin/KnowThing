<script lang="ts">
	import type { PageData } from './$types.js'
	import { invalidateAll } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api.js'
	import Button from '$lib/components/ui/Button.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushError, pushSuccess } from '$lib/notifications.svelte.js'
	import { deriveSystemType } from 'tungolcraft'
	import SunDim from 'phosphor-svelte/lib/SunDim'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import Trash from 'phosphor-svelte/lib/Trash'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	type RegistrySystem = {
		id: number
		name: string
		slug: string
		sectorName: string | null
		sectorSlug: string | null
		starCount: number
		planetCount: number
	}
	type RegistryStar = {
		id: number
		name: string
		slug: string
		spectralType: string | null
		systemId: number | null
	}
	type RegistryBody = {
		id: number
		name: string
		slug: string
		bodyType: string
		starId: number | null
		parentId: number | null
		moonCount: number
	}

	const systems = $derived(data.systems as unknown as RegistrySystem[])
	const stars = $derived(data.stars as unknown as RegistryStar[])
	const bodies = $derived(data.bodies as unknown as RegistryBody[])
	let deletingSlug = $state<string | null>(null)

	const orphanStars = $derived(stars.filter(star => star.systemId == null))
	const orphanBodies = $derived(bodies.filter(body => body.starId == null && body.parentId == null))

	function starsForSystem(systemId: number) {
		return stars.filter(star => star.systemId === systemId)
	}
	function planetsForStar(starId: number) {
		return bodies.filter(body => body.starId === starId && body.parentId == null)
	}
	function moonsForBody(bodyId: number) {
		return bodies.filter(body => body.parentId === bodyId)
	}

	async function deleteEntity(slug: string, name: string) {
		const confirmed = await confirmDialog.confirm(
			'Delete rodder record',
			`Delete “${name}”? Descendants are detached rather than deleted.`,
			'Delete',
			'Cancel',
		)
		if (!confirmed) return
		deletingSlug = slug
		try {
			await api('DELETE', `/api/rodder/${slug}`)
			pushSuccess(`“${name}” deleted`)
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Delete failed')
		} finally {
			deletingSlug = null
		}
	}
</script>

<div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
	<div>
		<h2 class="text-lg font-semibold text-heading">Registry</h2>
		<p class="mt-1 max-w-2xl text-sm text-secondary">Browse the authored hierarchy. Open a record to edit its identity, physical properties, orbit, or sector placement.</p>
	</div>
	<Button href={resolve('/rodder/manage/create')} size="sm">Add an object</Button>
</div>

{#if systems.length === 0 && orphanStars.length === 0 && orphanBodies.length === 0}
	<div class="border border-dashed border-border-subtle bg-surface p-10 text-center">
		<p class="font-medium text-heading">The registry is empty</p>
		<p class="mt-1 text-sm text-secondary">Create a system or seed a preset to begin.</p>
	</div>
{:else}
	<div class="space-y-3">
		{#each systems as system (system.id)}
			<section class="border border-border-subtle bg-surface">
				<header class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-raised px-4 py-3">
					<div class="flex min-w-0 items-center gap-3">
						<SunDim size={22} weight="fill" class="shrink-0 text-accent" />
						<div class="min-w-0">
							<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${system.slug}` })} class="font-semibold text-heading hover:text-link">{system.name}</a>
							<div class="text-xs text-secondary">
								{deriveSystemType(system.starCount)} · {system.starCount} {system.starCount === 1 ? 'star' : 'stars'} · {system.planetCount} {system.planetCount === 1 ? 'body' : 'bodies'}
								{#if system.sectorName && system.sectorSlug} · <a href={resolve('/rodder/sector/[slug]', { slug: system.sectorSlug })} class="text-link hover:text-link-hover">{system.sectorName}</a>{/if}
							</div>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${system.slug}/configure` })} variant="secondary" size="sm"><GearSix size={13} /> Configure</Button>
						{#if data.canDeleteRodder}
							<Button variant="secondary" size="sm" loading={deletingSlug === system.slug} onclick={() => deleteEntity(system.slug, system.name)} aria-label={`Delete ${system.name}`}><Trash size={13} /></Button>
						{/if}
					</div>
				</header>

				<div class="divide-y divide-border-subtle">
					{#each starsForSystem(system.id) as star (star.id)}
						<div class="px-4 py-3">
							<div class="flex items-center justify-between gap-3">
								<div class="flex min-w-0 items-center gap-2 pl-2">
									<StarIcon size={14} weight="fill" class="shrink-0 text-secondary" />
									<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${star.slug}` })} class="truncate text-sm font-semibold text-body hover:text-link">{star.name}</a>
									{#if star.spectralType}<span class="text-xs text-secondary">{star.spectralType}</span>{/if}
								</div>
								<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${star.slug}/configure` })} class="text-xs text-link hover:text-link-hover">Configure</a>
							</div>

							{#each planetsForStar(star.id) as body (body.id)}
								<div class="mt-2 flex items-center justify-between gap-3 pl-8">
									<div class="flex min-w-0 items-center gap-2">
										<Planet size={12} class="shrink-0 text-dim" />
										<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${body.slug}` })} class="truncate text-sm text-body hover:text-link">{body.name}</a>
										<span class="text-xs text-secondary">{body.bodyType.replace('_', ' ')}</span>
									</div>
									<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${body.slug}/configure` })} class="text-xs text-link hover:text-link-hover">Configure</a>
								</div>
								{#each moonsForBody(body.id) as moon (moon.id)}
									<div class="mt-1 flex items-center justify-between gap-3 pl-14">
										<div class="flex min-w-0 items-center gap-2 text-xs text-secondary"><Moon size={10} /> <a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${moon.slug}` })} class="truncate hover:text-link">{moon.name}</a></div>
										<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${moon.slug}/configure` })} class="text-xs text-link hover:text-link-hover">Configure</a>
									</div>
								{/each}
							{/each}
						</div>
					{:else}
						<p class="px-4 py-3 text-xs text-dim">No stars in this system.</p>
					{/each}
				</div>
			</section>
		{/each}

		{#if orphanStars.length > 0 || orphanBodies.length > 0}
			<section class="border border-warning-border bg-warning-bg p-4">
				<h3 class="text-sm font-semibold text-heading">Unassigned records</h3>
				<p class="mt-1 text-xs text-secondary">These records are outside a complete system hierarchy. Configure them to select a parent.</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each orphanStars as star (star.id)}
						<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${star.slug}/configure` })} class="border border-border-subtle bg-surface px-3 py-1.5 text-xs text-link hover:bg-raised"><StarIcon size={11} class="mr-1 inline" />{star.name}</a>
					{/each}
					{#each orphanBodies as body (body.id)}
						<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${body.slug}/configure` })} class="border border-border-subtle bg-surface px-3 py-1.5 text-xs text-link hover:bg-raised"><Planet size={11} class="mr-1 inline" />{body.name}</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
