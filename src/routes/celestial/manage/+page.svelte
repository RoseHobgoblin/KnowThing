<script lang="ts">
	import type { PageData } from './$types.js'
	import { m } from '$lib/paraglide/messages.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { celestialPresets } from '$lib/celestial/presets.js'
	import type { CelestialPreset } from '$lib/celestial/presets.js'
	import { deriveSystemType } from 'tungolcraft'
	import { celestialRegistryBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import SunDim from 'phosphor-svelte/lib/SunDim'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
	import X from 'phosphor-svelte/lib/X'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	type RegistrySystem = {
		id: number
		name: string
		slug: string
		starCount: number
		planetCount: number
	}

	type RegistryStar = {
		id: number
		name: string
		slug: string
		spectralType: string | null
		color: string | null
		systemId: number | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		parentStarId: number | null
		planetCount: number
	}

	type RegistryBody = {
		id: number
		name: string
		slug: string
		bodyType: string
		starId: number | null
		parentId: number | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		moonCount: number
	}

	const systems = $derived(data.systems as unknown as RegistrySystem[])
	const stars = $derived(data.stars as unknown as RegistryStar[])
	const bodies = $derived(data.bodies as unknown as RegistryBody[])

	let newSystemName = $state('')
	let newStarName = $state('')
	let newStarSystemId = $state<string | undefined>(undefined)
	let newBodyName = $state('')
	let newBodyType = $state('planet')
	let newBodyStarId = $state<string | undefined>(undefined)
	let newBodyParentId = $state<string | undefined>(undefined)
	const createEntityMutation = createMutation(() => ({
		mutationFn: (body: Record<string, unknown>) => api('POST', '/api/celestial', body),
	}))
	const presetMutation = createMutation(() => ({
		mutationFn: (preset: string) => api('POST', '/api/celestial/preset', { preset }),
	}))
	const deleteMutation = createMutation(() => ({
		mutationFn: (slug: string) => api('DELETE', `/api/celestial/${slug}`),
	}))
	const creating = $derived(createEntityMutation.isPending)

	const newBodyParentOptions = $derived(
		newBodyStarId
			? bodies.filter(body => body.starId === Number(newBodyStarId))
			: [],
	)

	$effect(() => {
		if (!newBodyParentId) return
		if (!newBodyParentOptions.some(body => String(body.id) === newBodyParentId)) {
			newBodyParentId = undefined
		}
	})

	function starsForSystem(systemId: number) {
		return stars.filter(star => star.systemId === systemId)
	}

	function orphanStars() {
		return stars.filter(star => !star.systemId)
	}

	function bodiesForStar(starId: number) {
		return bodies.filter(body => body.starId === starId && !body.parentId)
	}

	function orphanBodies() {
		return bodies.filter(body => !body.starId && !body.parentId)
	}

	function moonsForBody(bodyId: number) {
		return bodies.filter(body => body.parentId === bodyId)
	}

	const slugify = urlSlugify

	async function createSystem() {
		if (!newSystemName.trim()) return
		try {
			await createEntityMutation.mutateAsync({ kind: 'system', name: newSystemName.trim(), slug: slugify(newSystemName) })
			pushSuccess(m.cel_system_created({ name: newSystemName }))
			newSystemName = ''
			await invalidateAll()
		} catch (error) { pushError(error instanceof Error ? error.message : m.cel_failed_create()) }
	}

	async function createStar() {
		if (!newStarName.trim()) return
		try {
			await createEntityMutation.mutateAsync({
				kind: 'star',
				name: newStarName.trim(),
				slug: slugify(newStarName),
				parentId: newStarSystemId ? Number(newStarSystemId) : null,
			})
			pushSuccess(m.cel_star_created({ name: newStarName }))
			newStarName = ''
			newStarSystemId = undefined
			await invalidateAll()
		} catch (error) { pushError(error instanceof Error ? error.message : m.cel_failed_create()) }
	}

	async function createBody() {
		if (!newBodyName.trim()) return
		try {
			// A moon orbits its parent body; a planet orbits the star.
			const parentId = newBodyParentId ? Number(newBodyParentId) : (newBodyStarId ? Number(newBodyStarId) : null)
			await createEntityMutation.mutateAsync({
				kind: 'body',
				name: newBodyName.trim(),
				slug: slugify(newBodyName),
				bodyType: newBodyType,
				parentId,
			})
			pushSuccess(m.cel_body_created({ name: newBodyName }))
			newBodyName = ''
			newBodyStarId = undefined
			newBodyParentId = undefined
			await invalidateAll()
		} catch (error) { pushError(error instanceof Error ? error.message : m.cel_failed_create()) }
	}

	const creatingPreset = $derived(presetMutation.isPending)
	let presetProgress = $state('')

	// One server call seeds the whole system in a single transaction — a
	// failure part-way rolls everything back instead of orphaning half a system.
	async function createFromPreset(preset: CelestialPreset) {
		presetProgress = m.cel_creating_named({ name: preset.system.name })
		try {
			await presetMutation.mutateAsync(preset.label)
			pushSuccess(m.cel_preset_created({ name: preset.system.name }))
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.cel_failed_create_preset())
		} finally {
			presetProgress = ''
		}
	}

	async function deleteItem(slug: string, name: string) {
		const ok = await confirmDialog.confirm(m.common_delete(), m.common_delete_confirm_named({ name }), m.common_delete(), m.common_cancel())
		if (!ok) return
		try {
			await deleteMutation.mutateAsync(slug)
			pushSuccess(m.cel_deleted({ name }))
			await invalidateAll()
		} catch (error) { pushError(error instanceof Error ? error.message : m.cel_failed_delete()) }
	}
</script>

<svelte:head>
	<title>{m.cel_manage_registry()} — {m.nav_celestial()} — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={celestialRegistryBreadcrumbs()}
	title={m.cel_manage_registry()}
>
	{#snippet actions()}
		<a href="/celestial" class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover">
			<ArrowLeft size={14} weight="bold" />{m.cel_back_to_atlas()}
		</a>
	{/snippet}

	{#if systems.length === 0 && orphanStars().length === 0 && orphanBodies().length === 0}
		<div class="bg-surface p-8 text-center">
			<p class="text-dim">{m.cel_no_bodies_registered()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each systems as system (system.id)}
				<div class="bg-surface">
					<!-- System header -->
					<div class="flex items-center justify-between px-4 py-3 bg-raised border-b border-border-subtle">
						<div class="flex items-center gap-2">
							<SunDim size={20} weight="fill" class="text-accent" />
							<a href="/Celestial:{system.slug}" class="text-heading font-bold text-lg transition-colors hover:text-link">{system.name}</a>
							<span class="text-xs text-secondary">{deriveSystemType(system.starCount)} · {system.starCount} {system.starCount === 1 ? m.cel_word_star() : m.cel_word_stars()} · {system.planetCount} {system.planetCount === 1 ? m.cel_word_planet() : m.cel_word_planets()}</span>
						</div>
						<div class="flex items-center gap-3 text-xs">
							<a href="/Celestial:{system.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />{m.common_configure()}</a>
							<button onclick={() => deleteItem(system.slug, system.name)} class="text-error transition-colors hover:text-error-hover">{m.common_delete()}</button>
						</div>
					</div>

					<!-- Stars in this system -->
					{#each starsForSystem(system.id) as star (star.id)}
						<div class="border-b border-border-subtle last:border-0">
							<div class="flex items-center justify-between px-4 py-2.5">
								<div class="flex items-center gap-2 ml-2">
									<StarIcon size={14} weight="fill" class="text-secondary" />
									<a href="/Celestial:{star.slug}" class="text-heading font-semibold transition-colors hover:text-link">{star.name}</a>
									{#if star.spectralType}
										<span class="text-xs text-secondary">({star.spectralType})</span>
									{/if}
								</div>
								<div class="flex items-center gap-3 text-xs">
									<a href="/Celestial:{star.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />{m.common_configure()}</a>
									<button onclick={() => deleteItem(star.slug, star.name)} class="text-error transition-colors hover:text-error-hover" aria-label={m.cel_delete_named({ name: star.name })}><X size={12} weight="bold" /></button>
								</div>
							</div>

							<!-- Planets under this star -->
							{#each bodiesForStar(star.id) as planet (planet.id)}
								<div class="flex items-center justify-between px-4 py-1.5 ml-8">
									<div class="flex items-center gap-2">
										<Planet size={12} class="text-dim" />
										<a href="/Celestial:{planet.slug}" class="text-body text-sm transition-colors hover:text-link">{planet.name}</a>
										<span class="text-xs text-secondary">({planet.bodyType})</span>
										{#if planet.moonCount > 0}
											<span class="text-xs text-dim">· {planet.moonCount} {planet.moonCount === 1 ? m.cel_word_satellite() : m.cel_word_satellites()}</span>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-xs">
										<a href="/Celestial:{planet.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />{m.common_configure()}</a>
										<button onclick={() => deleteItem(planet.slug, planet.name)} class="text-error transition-colors hover:text-error-hover" aria-label={m.cel_delete_named({ name: planet.name })}><X size={12} weight="bold" /></button>
									</div>
								</div>
								{#each moonsForBody(planet.id) as moon (moon.id)}
									<div class="flex items-center justify-between px-4 py-1 ml-14">
										<div class="flex items-center gap-2">
											<Moon size={10} class="text-secondary" />
											<a href="/Celestial:{moon.slug}" class="text-xs text-secondary transition-colors hover:text-link">{moon.name}</a>
										</div>
										<div class="flex items-center gap-3 text-xs">
											<a href="/Celestial:{moon.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />{m.common_configure()}</a>
											<button onclick={() => deleteItem(moon.slug, moon.name)} class="text-error transition-colors hover:text-error-hover" aria-label={m.cel_delete_named({ name: moon.name })}><X size={12} weight="bold" /></button>
										</div>
									</div>
								{/each}
							{/each}
						</div>
					{/each}
				</div>
			{/each}

			<!-- Orphan stars (no system) -->
			{#if orphanStars().length > 0}
				<div class="bg-surface p-4">
					<span class="text-xs text-secondary uppercase tracking-wide">{m.cel_unassigned_stars()}</span>
					{#each orphanStars() as star (star.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<StarIcon size={14} weight="fill" class="text-secondary" />
								<span class="text-body">{star.name}</span>
								{#if star.spectralType}
									<span class="text-xs text-secondary">({star.spectralType})</span>
								{/if}
							</div>
							<a href="/Celestial:{star.slug}/configure" class="text-xs text-link flex items-center gap-1 transition-colors hover:text-link-hover"><GearSix size={12} weight="fill" />{m.common_configure()}</a>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Orphan bodies (no star) -->
			{#if orphanBodies().length > 0}
				<div class="bg-surface p-4">
					<span class="text-xs text-secondary uppercase tracking-wide">{m.cel_unassigned_bodies()}</span>
					{#each orphanBodies() as body (body.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<Planet size={12} class="text-dim" />
								<span class="text-body">{body.name}</span>
								<span class="text-xs text-secondary">({body.bodyType})</span>
							</div>
							<a href="/Celestial:{body.slug}/configure" class="text-xs text-link flex items-center gap-1 transition-colors hover:text-link-hover"><GearSix size={12} weight="fill" />{m.common_configure()}</a>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Create forms -->
	<div class="mt-8 space-y-4">
		<!-- Presets -->
		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">{m.cel_create_from_preset()}</h2>
			<p class="text-xs text-secondary">{m.cel_preset_help()}</p>
			<div class="flex flex-wrap gap-2">
				{#each celestialPresets as preset (preset.label)}
					<Button onclick={() => createFromPreset(preset)} loading={creatingPreset} disabled={creatingPreset}>
						{preset.label}
					</Button>
				{/each}
			</div>
			{#if presetProgress}
				<p class="text-xs text-secondary">{presetProgress}</p>
			{/if}
		</section>

		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">{m.cel_add_system()}</h2>
			<div class="flex gap-3 items-end">
				<Input label={m.common_name()} bind:value={newSystemName} placeholder={m.cel_ph_system_name()} containerClass="flex-1" />
				<Button onclick={createSystem} disabled={!newSystemName.trim()} loading={creating}>{m.common_add()}</Button>
			</div>
		</section>

		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">{m.cel_add_star()}</h2>
			<div class="flex gap-3 items-end">
				<Input label={m.common_name()} bind:value={newStarName} placeholder={m.cel_ph_star_name()} containerClass="flex-1" />
				<Select
					type="single"
					label={m.cel_label_system()}
					bind:value={newStarSystemId}
					placeholder={m.common_none()}
					items={systems.map(system => ({ value: String(system.id), label: system.name }))}
				/>
				<Button onclick={createStar} disabled={!newStarName.trim()} loading={creating}>{m.common_add()}</Button>
			</div>
		</section>

		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">{m.cel_add_body()}</h2>
			<p class="text-xs text-secondary">{m.cel_add_body_help()}</p>
			<div class="flex gap-3 items-end flex-wrap">
				<Input label={m.common_name()} bind:value={newBodyName} placeholder={m.cel_ph_body_name()} containerClass="flex-1 min-w-40" />
				<Select
					type="single"
					label={m.common_type()}
					bind:value={newBodyType}
					items={[
						{ value: 'planet', label: m.cel_type_planet() },
						{ value: 'asteroid', label: m.cel_type_asteroid() },
						{ value: 'ring_system', label: m.cel_type_ring_system() },
					]}
				/>
				<Select
					type="single"
					label={m.cel_star()}
					bind:value={newBodyStarId}
					placeholder={m.common_none()}
					items={stars.map(star => ({ value: String(star.id), label: star.name }))}
				/>
				<Select
					type="single"
					label={m.cel_orbits_body()}
					bind:value={newBodyParentId}
					placeholder={newBodyStarId ? m.cel_ph_none_orbits_star() : m.cel_ph_pick_star_first()}
					disabled={!newBodyStarId || newBodyParentOptions.length === 0}
					items={newBodyParentOptions.map(body => ({ value: String(body.id), label: body.name }))}
				/>
				<Button onclick={createBody} disabled={!newBodyName.trim() || (newBodyType === 'ring_system' && !newBodyParentId)} loading={creating}>{m.common_add()}</Button>
			</div>
		</section>
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
