<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	// Create star form
	let newStarName = $state('')
	let newStarSlug = $state('')
	let creatingStar = $state(false)

	// Create body form
	let newBodyName = $state('')
	let newBodySlug = $state('')
	let newBodyType = $state('planet')
	let newBodyStarId = $state<number | null>(null)
	let creatingBody = $state(false)

	const starSlug = $derived(newStarName.trim().toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^\da-z-]/g, ''))

	$effect(() => {
		if (!newStarSlug || newStarSlug === starSlug) {
			newStarSlug = starSlug
		}
	})

	const bodySlug = $derived(newBodyName.trim().toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^\da-z-]/g, ''))

	$effect(() => {
		if (!newBodySlug || newBodySlug === bodySlug) {
			newBodySlug = bodySlug
		}
	})

	async function createStar() {
		if (!newStarName.trim()) return
		creatingStar = true
		try {
			const res = await fetch('/api/stars', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newStarName.trim(), slug: newStarSlug.trim() || starSlug }),
			})
			if (res.ok) {
				pushSuccess(`Star "${newStarName}" created`)
				newStarName = ''
				newStarSlug = ''
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create star')
			}
		} finally {
			creatingStar = false
		}
	}

	async function createBody() {
		if (!newBodyName.trim()) return
		creatingBody = true
		try {
			const res = await fetch('/api/planetary-bodies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newBodyName.trim(),
					slug: newBodySlug.trim() || bodySlug,
					bodyType: newBodyType,
					starId: newBodyStarId,
				}),
			})
			if (res.ok) {
				pushSuccess(`${newBodyName} created`)
				newBodyName = ''
				newBodySlug = ''
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create body')
			}
		} finally {
			creatingBody = false
		}
	}

	async function deleteStar(slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete star', `Delete "${name}" and orphan all its planets?`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/stars/${slug}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		} else {
			pushError('Failed to delete')
		}
	}

	async function deleteBody(slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete body', `Delete "${name}"?`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/planetary-bodies/${slug}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		} else {
			pushError('Failed to delete')
		}
	}

	function bodiesForStar(starId: number) {
		return (data.bodies as any[]).filter((b: any) => b.starId === starId && !b.parentId)
	}

	function moonsForBody(bodyId: number) {
		return (data.bodies as any[]).filter((b: any) => b.parentId === bodyId)
	}
</script>

<svelte:head>
	<title>Celestial Registry — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold text-heading">Celestial Registry</h1>

	<!-- System tree -->
	{#if (data.stars as any[]).length === 0}
		<div class="bg-surface border border-border p-6 text-center">
			<p class="text-dim">No stars registered yet.</p>
		</div>
	{:else}
		{#each data.stars as star (star.id)}
			<div class="bg-surface border border-border">
				<div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
					<a href="/dashboard/celestial/{star.slug}" class="flex items-center gap-2 text-heading font-semibold hover:text-link">
						<span class="text-lg">★</span>
						{star.name}
						{#if star.spectralType}
							<span class="text-xs text-faint font-normal">({star.spectralType})</span>
						{/if}
					</a>
					<div class="flex items-center gap-3 text-xs">
						<span class="text-faint">{star.planetCount} planets</span>
						<button onclick={() => deleteStar(star.slug, star.name)} class="text-error transition-colors hover:text-error-hover">Delete</button>
					</div>
				</div>

				{#if bodiesForStar(star.id).length > 0}
					<div class="px-4 py-2 space-y-1">
						{#each bodiesForStar(star.id) as planet (planet.id)}
							<div>
								<div class="flex items-center justify-between py-1.5">
									<a href="/dashboard/celestial/{planet.slug}" class="flex items-center gap-2 text-sm text-body hover:text-link">
										<span class="text-secondary ml-4">●</span>
										{planet.name}
										<span class="text-xs text-faint">({planet.bodyType})</span>
									</a>
									<div class="flex items-center gap-3 text-xs">
										{#if planet.moonCount > 0}
											<span class="text-faint">{planet.moonCount} moons</span>
										{/if}
										<button onclick={() => deleteBody(planet.slug, planet.name)} class="text-error transition-colors hover:text-error-hover">×</button>
									</div>
								</div>
								{#each moonsForBody(planet.id) as moon (moon.id)}
									<div class="flex items-center justify-between py-1 ml-10">
										<a href="/dashboard/celestial/{moon.slug}" class="flex items-center gap-2 text-xs text-secondary hover:text-link">
											<span class="text-faint">○</span>
											{moon.name}
										</a>
										<button onclick={() => deleteBody(moon.slug, moon.name)} class="text-xs text-error transition-colors hover:text-error-hover">×</button>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	{/if}

	<!-- Create star -->
	<section class="bg-surface border border-border p-5 space-y-3">
		<h2 class="text-sm font-semibold text-heading">Add Star</h2>
		<div class="flex gap-3 items-end">
			<Input label="Name" bind:value={newStarName} placeholder="e.g. The Sun" containerClass="flex-1" />
			<Input label="Slug" bind:value={newStarSlug} placeholder="auto-generated" containerClass="w-40" />
			<button onclick={createStar} disabled={creatingStar || !newStarName.trim()} class="
				px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors
				hover:bg-accent-hover
				disabled:opacity-50
			">
				{creatingStar ? 'Creating...' : 'Add'}
			</button>
		</div>
	</section>

	<!-- Create body -->
	<section class="bg-surface border border-border p-5 space-y-3">
		<h2 class="text-sm font-semibold text-heading">Add Planetary Body</h2>
		<div class="flex gap-3 items-end flex-wrap">
			<Input label="Name" bind:value={newBodyName} placeholder="e.g. Earth" containerClass="flex-1 min-w-40" />
			<Input label="Slug" bind:value={newBodySlug} placeholder="auto-generated" containerClass="w-32" />
			<div>
				<span class="text-xs font-medium text-secondary block mb-1">Type</span>
				<select bind:value={newBodyType} class="
					p-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors
					hover:border-border
					focus:ring-2 focus:ring-accent
				">
					<option value="planet">Planet</option>
					<option value="moon">Moon</option>
					<option value="dwarf_planet">Dwarf planet</option>
					<option value="asteroid">Asteroid</option>
				</select>
			</div>
			<div>
				<span class="text-xs font-medium text-secondary block mb-1">Star</span>
				<select bind:value={newBodyStarId} class="
					p-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors
					hover:border-border
					focus:ring-2 focus:ring-accent
				">
					<option value={null}>None</option>
					{#each data.stars as star (star.id)}
						<option value={star.id}>{star.name}</option>
					{/each}
				</select>
			</div>
			<button onclick={createBody} disabled={creatingBody || !newBodyName.trim()} class="
				px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors
				hover:bg-accent-hover
				disabled:opacity-50
			">
				{creatingBody ? 'Creating...' : 'Add'}
			</button>
		</div>
	</section>
</div>

<ConfirmDialog bind:this={confirmDialog} />
