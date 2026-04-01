<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { celestialPresets } from '$lib/celestial/presets.js'
	import type { CelestialPreset, BodyPreset } from '$lib/celestial/presets.js'
	import { celestialBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import SunDim from 'phosphor-svelte/lib/SunDim'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import X from 'phosphor-svelte/lib/X'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	type RegistrySystem = {
		id: number
		name: string
		slug: string
		systemType: string | null
		pageSlug: string | null
		starCount: number
		planetCount: number
	}

	type RegistryStar = {
		id: number
		name: string
		slug: string
		spectralType: string | null
		color: string | null
		pageSlug: string | null
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
		pageSlug: string | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		moonCount: number
	}

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})
	const systems = $derived(data.systems as RegistrySystem[])
	const stars = $derived(data.stars as RegistryStar[])
	const bodies = $derived(data.bodies as RegistryBody[])

	let newSystemName = $state('')
	let newStarName = $state('')
	let newStarSystemId = $state<string | undefined>(undefined)
	let newBodyName = $state('')
	let newBodyType = $state('planet')
	let newBodyStarId = $state<string | undefined>(undefined)
	let creating = $state(false)

	function starsForSystem(systemId: number) {
		return stars.filter((star) => star.systemId === systemId)
	}

	function orphanStars() {
		return stars.filter((star) => !star.systemId)
	}

	function bodiesForStar(starId: number) {
		return bodies.filter((body) => body.starId === starId && !body.parentId)
	}

	function orphanBodies() {
		return bodies.filter((body) => !body.starId && !body.parentId)
	}

	function moonsForBody(bodyId: number) {
		return bodies.filter((body) => body.parentId === bodyId)
	}

	const slugify = urlSlugify

	async function createSystem() {
		if (!newSystemName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/star-systems', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newSystemName.trim(), slug: slugify(newSystemName) }),
			})
			if (res.ok) {
				pushSuccess(`System "${newSystemName}" created`)
				newSystemName = ''
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create')
			}
		} finally { creating = false }
	}

	async function createStar() {
		if (!newStarName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/stars', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newStarName.trim(),
					slug: slugify(newStarName),
					systemId: newStarSystemId ? Number(newStarSystemId) : null,
				}),
			})
			if (res.ok) {
				pushSuccess(`Star "${newStarName}" created`)
				newStarName = ''
				newStarSystemId = undefined
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create')
			}
		} finally { creating = false }
	}

	async function createBody() {
		if (!newBodyName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/planetary-bodies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newBodyName.trim(),
					slug: slugify(newBodyName),
					bodyType: newBodyType,
					starId: newBodyStarId ? Number(newBodyStarId) : null,
				}),
			})
			if (res.ok) {
				pushSuccess(`${newBodyName} created`)
				newBodyName = ''
				newBodyStarId = undefined
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create')
			}
		} finally { creating = false }
	}

	let creatingPreset = $state(false)
	let presetProgress = $state('')

	async function createFromPreset(preset: CelestialPreset) {
		creatingPreset = true
		presetProgress = 'Creating system...'
		try {
			// 1. Create system
			const sysRes = await fetch('/api/star-systems', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: preset.system.name, slug: slugify(preset.system.name), systemType: preset.system.systemType }),
			})
			if (!sysRes.ok) { pushError('Failed to create system'); return }
			const sys = await sysRes.json()

			// 2. Create stars
			for (const starPreset of preset.stars) {
				presetProgress = `Creating star: ${starPreset.name}...`
				const starRes = await fetch('/api/stars', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: starPreset.name, slug: slugify(starPreset.name), systemId: sys.id,
						spectralType: starPreset.spectralType, mass: starPreset.mass, massKg: starPreset.massKg,
						radius: starPreset.radius, radiusM: starPreset.radiusM,
						luminosity: starPreset.luminosity, temperature: starPreset.temperature,
						age: starPreset.age, color: starPreset.color, apparentMagnitude: starPreset.apparentMagnitude,
					}),
				})
				if (!starRes.ok) { pushError(`Failed to create star: ${starPreset.name}`); continue }
				const star = await starRes.json()

				// 3. Create bodies under this star
				for (const bodyPreset of starPreset.bodies) {
					presetProgress = `Creating ${bodyPreset.bodyType}: ${bodyPreset.name}...`
					const planetId = await createPresetBody(bodyPreset, star.id, null)

					// 4. Create moons under this body
					if (planetId && bodyPreset.moons) {
						for (const moonPreset of bodyPreset.moons) {
							presetProgress = `Creating moon: ${moonPreset.name}...`
							await createPresetBody(moonPreset, star.id, planetId)
						}
					}
				}
			}

			pushSuccess(`Created "${preset.system.name}" with all bodies`)
			invalidateAll()
		} catch {
			pushError('Failed to create preset')
		} finally {
			creatingPreset = false
			presetProgress = ''
		}
	}

	async function createPresetBody(body: BodyPreset, starId: number, parentId: number | null): Promise<number | null> {
		const response = await fetch('/api/planetary-bodies', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: body.name, slug: slugify(body.name), bodyType: body.bodyType, starId, parentId,
				mass: body.mass, massKg: body.massKg, radius: body.radius, radiusM: body.radiusM,
				temperature: body.temperature,
				atmosphere: body.atmosphere || null, composition: body.composition,
				orbitalPeriodDays: body.orbitalPeriodDays,
				semiMajorAxisAu: body.semiMajorAxisAu, eccentricity: body.eccentricity,
				inclination: body.inclination,
				rotationPeriodS: body.rotationPeriodS, axialTilt: body.axialTilt,
				hasRings: body.hasRings,
			}),
		})
		if (!response.ok) { pushError(`Failed to create: ${body.name}`); return null }
		const created = await response.json()
		return created.id
	}

	async function deleteItem(type: string, slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete', `Delete "${name}"?`, 'Delete', 'Cancel')
		if (!ok) return
		const endpoint = type === 'system' ? `/api/star-systems/${slug}` : (type === 'star' ? `/api/stars/${slug}` : `/api/planetary-bodies/${slug}`)
		const res = await fetch(endpoint, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		} else pushError('Failed to delete')
	}
</script>

<svelte:head>
	<title>Celestial Registry — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={celestialBreadcrumbs()}
	title="Celestial Registry"
>

	{#if systems.length === 0 && orphanStars().length === 0 && orphanBodies().length === 0}
		<div class="bg-surface border border-border p-8 text-center">
			<p class="text-dim">No celestial bodies registered yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each systems as system (system.id)}
				<div class="bg-surface border border-border">
					<!-- System header -->
					<div class="flex items-center justify-between px-4 py-3 bg-raised border-b border-border-subtle">
						<div class="flex items-center gap-2">
							<SunDim size={20} weight="fill" class="text-accent" />
							<a href="/celestial/{system.slug}" class="text-heading font-bold text-lg transition-colors hover:text-link">{system.name}</a>
							<span class="text-xs text-faint">{system.systemType} · {system.starCount} {system.starCount === 1 ? 'star' : 'stars'} · {system.planetCount} {system.planetCount === 1 ? 'planet' : 'planets'}</span>
						</div>
						{#if permissions.canEditContent}
							<div class="flex items-center gap-3 text-xs">
								<a href="/celestial/{system.slug}/edit" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={12} weight="fill" />Edit</a>
								<button onclick={() => deleteItem('system', system.slug, system.name)} class="text-error transition-colors hover:text-error-hover">Delete</button>
							</div>
						{/if}
					</div>

					<!-- Stars in this system -->
					{#each starsForSystem(system.id) as star (star.id)}
						<div class="border-b border-border-subtle last:border-0">
							<div class="flex items-center justify-between px-4 py-2.5">
								<div class="flex items-center gap-2 ml-2">
									<StarIcon size={14} weight="fill" class="text-secondary" />
									<a href="/celestial/{system.slug}/{star.slug}" class="text-heading font-semibold transition-colors hover:text-link">{star.name}</a>
									{#if star.spectralType}
										<span class="text-xs text-faint">({star.spectralType})</span>
									{/if}
								</div>
								{#if permissions.canConfigureCelestial}
									<div class="flex items-center gap-3 text-xs">
										<a href="/celestial/{system.slug}/{star.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
										<button onclick={() => deleteItem('star', star.slug, star.name)} class="text-error transition-colors hover:text-error-hover" aria-label="Delete {star.name}"><X size={12} weight="bold" /></button>
									</div>
								{/if}
							</div>

							<!-- Planets under this star -->
							{#each bodiesForStar(star.id) as planet (planet.id)}
								<div class="flex items-center justify-between px-4 py-1.5 ml-8">
									<div class="flex items-center gap-2">
										<Planet size={12} class="text-dim" />
										<a href="/celestial/{system.slug}/{planet.slug}" class="text-body text-sm transition-colors hover:text-link">{planet.name}</a>
										<span class="text-xs text-faint">({planet.bodyType})</span>
										{#if planet.moonCount > 0}
											<span class="text-xs text-dim">· {planet.moonCount} {planet.moonCount === 1 ? 'moon' : 'moons'}</span>
										{/if}
									</div>
									{#if permissions.canConfigureCelestial}
										<div class="flex items-center gap-3 text-xs">
											<a href="/celestial/{system.slug}/{planet.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
											<button onclick={() => deleteItem('body', planet.slug, planet.name)} class="text-error transition-colors hover:text-error-hover" aria-label="Delete {planet.name}"><X size={12} weight="bold" /></button>
										</div>
									{/if}
								</div>
								{#each moonsForBody(planet.id) as moon (moon.id)}
									<div class="flex items-center justify-between px-4 py-1 ml-14">
										<div class="flex items-center gap-2">
											<Moon size={10} class="text-faint" />
											<a href="/celestial/{system.slug}/{moon.slug}" class="text-xs text-secondary transition-colors hover:text-link">{moon.name}</a>
										</div>
										{#if permissions.canConfigureCelestial}
											<div class="flex items-center gap-3 text-xs">
												<a href="/celestial/{system.slug}/{moon.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
												<button onclick={() => deleteItem('body', moon.slug, moon.name)} class="text-error transition-colors hover:text-error-hover" aria-label="Delete {moon.name}"><X size={12} weight="bold" /></button>
											</div>
										{/if}
									</div>
								{/each}
							{/each}
						</div>
					{/each}
				</div>
			{/each}

			<!-- Orphan stars (no system) -->
			{#if orphanStars().length > 0}
				<div class="bg-surface border border-border p-4">
					<span class="text-xs text-faint uppercase tracking-wide">Unassigned Stars</span>
					{#each orphanStars() as star (star.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<StarIcon size={14} weight="fill" class="text-secondary" />
								<span class="text-body">{star.name}</span>
								{#if star.spectralType}
									<span class="text-xs text-faint">({star.spectralType})</span>
								{/if}
							</div>
							{#if permissions.canConfigureCelestial}
								<a href="/celestial/{star.slug}/configure" class="text-xs text-link flex items-center gap-1 transition-colors hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Orphan bodies (no star) -->
			{#if orphanBodies().length > 0}
				<div class="bg-surface border border-border p-4">
					<span class="text-xs text-faint uppercase tracking-wide">Unassigned Bodies</span>
					{#each orphanBodies() as body (body.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<Planet size={12} class="text-dim" />
								<span class="text-body">{body.name}</span>
								<span class="text-xs text-faint">({body.bodyType})</span>
							</div>
							{#if permissions.canConfigureCelestial}
								<a href="/celestial/{body.slug}/configure" class="text-xs text-link flex items-center gap-1 transition-colors hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Admin: create forms -->
	{#if permissions.canConfigureCelestial}
		<div class="mt-8 space-y-4">
			<!-- Presets -->
			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Create from Preset</h2>
				<p class="text-xs text-faint">Populate an entire system with real-world data. Creates the system, stars, planets, and moons in one go.</p>
				<div class="flex flex-wrap gap-2">
					{#each celestialPresets as preset}
						<Button onclick={() => createFromPreset(preset)} loading={creatingPreset} disabled={creatingPreset}>
							{preset.label}
						</Button>
					{/each}
				</div>
				{#if presetProgress}
					<p class="text-xs text-secondary">{presetProgress}</p>
				{/if}
			</section>

			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add System</h2>
				<div class="flex gap-3 items-end">
					<Input label="Name" bind:value={newSystemName} placeholder="e.g. Sunly system" containerClass="flex-1" />
					<Button onclick={createSystem} disabled={!newSystemName.trim()} loading={creating}>Add</Button>
				</div>
			</section>

			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add Star</h2>
				<div class="flex gap-3 items-end">
					<Input label="Name" bind:value={newStarName} placeholder="e.g. The Sun" containerClass="flex-1" />
					<Select
						type="single"
						label="System"
						bind:value={newStarSystemId}
						placeholder="None"
						items={systems.map((system) => ({ value: String(system.id), label: system.name }))}
					/>
					<Button onclick={createStar} disabled={!newStarName.trim()} loading={creating}>Add</Button>
				</div>
			</section>

			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add Body</h2>
				<div class="flex gap-3 items-end flex-wrap">
					<Input label="Name" bind:value={newBodyName} placeholder="e.g. Earth" containerClass="flex-1 min-w-40" />
					<Select
						type="single"
						label="Type"
						bind:value={newBodyType}
						items={[
							{ value: 'planet', label: 'Planet' },
							{ value: 'moon', label: 'Moon' },
							{ value: 'dwarf_planet', label: 'Dwarf planet' },
							{ value: 'asteroid', label: 'Asteroid' },
						]}
					/>
					<Select
						type="single"
						label="Star"
						bind:value={newBodyStarId}
						placeholder="None"
						items={stars.map((star) => ({ value: String(star.id), label: star.name }))}
					/>
					<Button onclick={createBody} disabled={!newBodyName.trim()} loading={creating}>Add</Button>
				</div>
			</section>
		</div>
	{:else if permissions.isAuthenticated}
		<div class="mt-8 bg-surface border border-border p-5">
			<p class="text-sm text-faint">Editor role required to add or configure celestial records.</p>
		</div>
	{/if}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
