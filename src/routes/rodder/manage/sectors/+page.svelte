<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types.js'
	import { invalidateAll } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api.js'
	import Button from '$lib/components/ui/Button.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { createSectorSchema } from '$lib/rodder/sector-schema.js'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { cn } from '$lib/utils.js'
	import { pushError, pushSuccess } from '$lib/notifications.svelte.js'
	import Compass from 'phosphor-svelte/lib/Compass'
	import Cube from 'phosphor-svelte/lib/Cube'
	import Plus from 'phosphor-svelte/lib/Plus'
	import Trash from 'phosphor-svelte/lib/Trash'
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	type Sector = {
		id: number
		name: string
		slug: string
		description: string
		units: string
		shape: string | null
		radius: number | null
		extentX: number | null
		extentY: number | null
		extentZ: number | null
		originKind: string
		originBodyId: number | null
		axesNote: string | null
		handedness: string
		referenceEpoch: string | null
		provenance: string
		rootCount: number
		positionedCount: number
	}
	type System = {
		id: number
		name: string
		slug: string
		sectorId: number | null
		sectorX: number | null
		sectorY: number | null
		sectorZ: number | null
	}
	type SectorDraft = {
		name: string
		slug: string
		description: string
		units: string
		shape: string
		radius: number | null
		extentX: number | null
		extentY: number | null
		extentZ: number | null
		originKind: string
		originBodyId: string
		axesNote: string
		handedness: string
		referenceEpoch: string
		provenance: string
	}

	const sectors = $derived(data.sectors as unknown as Sector[])
	const systems = $derived(data.systems as unknown as System[])
	const initialSector = untrack(() => sectors[0] ?? null)

	function draftFrom(sector: Sector | null): SectorDraft {
		return {
			name: sector?.name ?? '',
			slug: sector?.slug ?? '',
			description: sector?.description ?? '',
			units: sector?.units ?? 'ly',
			shape: sector?.shape ?? '',
			radius: sector?.radius ?? null,
			extentX: sector?.extentX ?? null,
			extentY: sector?.extentY ?? null,
			extentZ: sector?.extentZ ?? null,
			originKind: sector?.originKind ?? 'frame-centred',
			originBodyId: sector?.originBodyId == null ? '' : String(sector.originBodyId),
			axesNote: sector?.axesNote ?? '',
			handedness: sector?.handedness ?? 'right-handed',
			referenceEpoch: sector?.referenceEpoch ?? '',
			provenance: sector?.provenance ?? 'authored',
		}
	}

	let selectedId = $state<number | null>(initialSector?.id ?? null)
	let creating = $state(initialSector == null)
	let draft = $state<SectorDraft>(draftFrom(initialSector))
	let savedSlug = $state(initialSector?.slug ?? '')
	let slugEdited = $state(false)
	let saving = $state(false)
	let deleting = $state(false)

	const selectedSector = $derived(sectors.find(sector => sector.id === selectedId) ?? null)
	const roots = $derived(selectedId == null ? [] : systems.filter(system => system.sectorId === selectedId))
	const unassigned = $derived(systems.filter(system => system.sectorId == null))

	function payload() {
		return {
			name: draft.name,
			slug: draft.slug,
			description: draft.description,
			units: draft.units,
			shape: draft.shape || null,
			radius: draft.shape === 'sphere' ? draft.radius : null,
			extentX: draft.shape === 'cuboid' ? draft.extentX : null,
			extentY: draft.shape === 'cuboid' ? draft.extentY : null,
			extentZ: draft.shape === 'cuboid' ? draft.extentZ : null,
			originKind: draft.originKind,
			originBodyId: draft.originKind === 'object-centred' && draft.originBodyId ? Number(draft.originBodyId) : null,
			axesNote: draft.axesNote || null,
			handedness: draft.handedness,
			referenceEpoch: draft.referenceEpoch || null,
			provenance: draft.provenance,
		}
	}

	const validation = $derived(createSectorSchema.safeParse(payload()))
	const validationMessage = $derived(validation.success ? '' : validation.error.issues[0]?.message ?? 'Review the frame fields')

	function editSector(sector: Sector) {
		selectedId = sector.id
		creating = false
		draft = draftFrom(sector)
		savedSlug = sector.slug
		slugEdited = false
	}

	function beginCreate() {
		selectedId = null
		creating = true
		draft = draftFrom(null)
		savedSlug = ''
		slugEdited = false
	}

	async function saveSector() {
		if (!validation.success || saving) return
		saving = true
		try {
			const saved = creating
				? await api<Sector>('POST', '/api/rodder/sectors', validation.data)
				: await api<Sector>('PUT', `/api/rodder/sectors/${savedSlug}`, validation.data)
			pushSuccess(creating ? `Sector “${saved.name}” created` : `Sector “${saved.name}” saved`)
			creating = false
			selectedId = saved.id
			savedSlug = saved.slug
			draft = draftFrom({ ...saved, rootCount: selectedSector?.rootCount ?? 0, positionedCount: selectedSector?.positionedCount ?? 0 })
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Sector save failed')
		} finally {
			saving = false
		}
	}

	async function deleteCurrentSector() {
		if (!selectedSector || selectedSector.rootCount > 0 || !data.canDeleteRodder) return
		const deletedSector = selectedSector
		const confirmed = await confirmDialog.confirm(
			'Delete sector',
			`Delete the empty sector “${deletedSector.name}”?`,
			'Delete Sector',
			'Cancel',
		)
		if (!confirmed) return
		deleting = true
		try {
			await api('DELETE', `/api/rodder/sectors/${deletedSector.slug}`)
			pushSuccess(`Sector “${deletedSector.name}” deleted`)
			await invalidateAll()
			const next = sectors.find(sector => sector.id !== deletedSector.id) ?? null
			if (next) editSector(next)
			else beginCreate()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Sector delete failed')
		} finally {
			deleting = false
		}
	}
</script>

<div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
	<div>
		<h2 class="text-lg font-semibold text-heading">Sectors</h2>
		<p class="mt-1 max-w-2xl text-sm text-secondary">Define the coordinate frames that contain star systems. Units, origin, orientation, and extent give every XYZ position a declared meaning.</p>
	</div>
	<Button size="sm" onclick={beginCreate}><Plus size={13} weight="bold" /> New sector</Button>
</div>

<div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[250px_1fr]">
	<aside class="space-y-2 lg:sticky lg:top-4">
		{#each sectors as sector (sector.id)}
			<button
				type="button"
				onclick={() => editSector(sector)}
				class={cn(
					'w-full border p-3 text-left transition-colors',
					!creating && selectedId === sector.id ? 'border-accent-border bg-accent-subtle' : 'border-border-subtle bg-surface hover:bg-raised',
				)}
			>
				<span class="flex items-center justify-between gap-2">
					<span class="truncate text-sm font-semibold text-heading">{sector.name}</span>
					<span class="shrink-0 text-xs text-secondary">{sector.units}</span>
				</span>
				<span class="mt-1 block text-xs text-secondary">{sector.rootCount} {sector.rootCount === 1 ? 'system' : 'systems'} · {sector.positionedCount} positioned</span>
			</button>
		{:else}
			<div class="border border-dashed border-border-subtle p-4 text-sm text-secondary">No sectors yet.</div>
		{/each}

		{#if unassigned.length > 0}
			<div class="border border-warning-border bg-warning-bg p-3 text-xs text-body">
				<strong>{unassigned.length} unassigned {unassigned.length === 1 ? 'system' : 'systems'}.</strong>
				Open each system’s configuration to place it in a sector.
			</div>
		{/if}
	</aside>

	<div class="min-w-0 space-y-4">
		<section class="border border-border-subtle bg-surface">
			<header class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-raised px-5 py-3">
				<div class="flex items-center gap-2">
					<Compass size={18} weight="fill" class="text-accent" />
					<h3 class="font-semibold text-heading">{creating ? 'New coordinate frame' : draft.name || 'Unnamed sector'}</h3>
				</div>
				{#if !creating && selectedSector}
					<a href={resolve('/rodder/sector/[slug]', { slug: selectedSector.slug })} class="flex items-center gap-1 text-xs text-link hover:text-link-hover">Open map <ArrowSquareOut size={12} /></a>
				{/if}
			</header>

			<div class="space-y-5 p-5">
				<div>
					<h4 class="mb-3 text-xs font-semibold tracking-wider text-secondary uppercase">Identity</h4>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input label="Name" bind:value={draft.name} oninput={() => { if (!slugEdited) draft.slug = urlSlugify(draft.name) }} />
						<Input label="Slug" bind:value={draft.slug} oninput={() => { slugEdited = true }} hint="URL identifier used by the sector map." />
						<Input label="Description" bind:value={draft.description} containerClass="md:col-span-2" />
					</div>
				</div>

				<div class="border-t border-border-subtle pt-5">
					<h4 class="mb-3 text-xs font-semibold tracking-wider text-secondary uppercase">Reference frame</h4>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
						<Select type="single" label="Units" bind:value={draft.units} items={[{ value: 'ly', label: 'Light-years (ly)' }, { value: 'pc', label: 'Parsecs (pc)' }]} />
						<Select type="single" label="Handedness" bind:value={draft.handedness} items={[{ value: 'right-handed', label: 'Right-handed' }, { value: 'left-handed', label: 'Left-handed' }]} />
						<Select type="single" label="Provenance" bind:value={draft.provenance} items={[
							{ value: 'authored', label: 'Authored' }, { value: 'imported', label: 'Imported' },
							{ value: 'transformed', label: 'Transformed' }, { value: 'approximate', label: 'Approximate' },
							{ value: 'legacy', label: 'Legacy' },
						]} />
						<Select type="single" label="Origin" bind:value={draft.originKind} items={[
							{ value: 'frame-centred', label: 'Frame-centred (arbitrary)' },
							{ value: 'object-centred', label: 'Object-centred' },
							{ value: 'imported', label: 'Defined by imported data' },
						]} />
						{#if draft.originKind === 'object-centred'}
							<Select type="single" label="Origin system" bind:value={draft.originBodyId} items={systems.map(system => ({ value: String(system.id), label: system.name }))} placeholder="Choose a system" />
						{/if}
						<Input label="Reference epoch" bind:value={draft.referenceEpoch} placeholder="e.g. J2000.0" />
						<Input label="Axis definition" bind:value={draft.axesNote} containerClass="md:col-span-3" placeholder="Describe +X, +Y, and +Z directions or imported axis conventions" />
					</div>
				</div>

				<div class="border-t border-border-subtle pt-5">
					<div class="mb-3 flex items-center gap-2"><Cube size={15} class="text-accent" /><h4 class="text-xs font-semibold tracking-wider text-secondary uppercase">Extent</h4></div>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
						<Select type="single" label="Shape" bind:value={draft.shape} items={[{ value: '', label: 'Undeclared' }, { value: 'sphere', label: 'Sphere' }, { value: 'cuboid', label: 'Cuboid' }]} />
						{#if draft.shape === 'sphere'}
							<Input label={`Radius (${draft.units})`} type="number" min="0" step="any" bind:value={draft.radius} />
						{:else if draft.shape === 'cuboid'}
							<Input label={`X extent (${draft.units})`} type="number" min="0" step="any" bind:value={draft.extentX} />
							<Input label={`Y extent (${draft.units})`} type="number" min="0" step="any" bind:value={draft.extentY} />
							<Input label={`Z extent (${draft.units})`} type="number" min="0" step="any" bind:value={draft.extentZ} />
						{:else}
							<p class="self-end pb-2 text-xs text-secondary md:col-span-3">Leave the extent undeclared when the source frame does not provide a trustworthy boundary.</p>
						{/if}
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
					<span class={cn('text-xs', validationMessage ? 'text-error' : 'text-secondary')}>{validationMessage || 'Frame contract is valid.'}</span>
					<div class="flex items-center gap-2">
						{#if !creating && selectedSector && data.canDeleteRodder}
							<Button variant="secondary" size="sm" disabled={selectedSector.rootCount > 0} loading={deleting} onclick={deleteCurrentSector} title={selectedSector.rootCount > 0 ? 'Move every system before deleting this sector' : undefined}><Trash size={13} /> Delete</Button>
						{/if}
						<Button onclick={saveSector} disabled={!validation.success} loading={saving}>{creating ? 'Create sector' : 'Save frame'}</Button>
					</div>
				</div>
			</div>
		</section>

		{#if !creating && selectedSector}
			<section class="border border-border-subtle bg-surface">
				<header class="border-b border-border-subtle px-4 py-3">
					<h3 class="text-sm font-semibold text-heading">System roots</h3>
					<p class="mt-0.5 text-xs text-secondary">Membership and coordinates are edited on the system record, where the position and its frame stay together.</p>
				</header>
				<div class="divide-y divide-border-subtle">
					{#each roots as root (root.id)}
						<div class="flex items-center justify-between gap-3 px-4 py-2.5">
							<div class="min-w-0">
								<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${root.slug}` })} class="truncate text-sm font-medium text-body hover:text-link">{root.name}</a>
								<div class="text-xs text-secondary">{root.sectorX == null || root.sectorY == null || root.sectorZ == null ? 'Position unavailable' : `${root.sectorX}, ${root.sectorY}, ${root.sectorZ} ${selectedSector.units}`}</div>
							</div>
							<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${root.slug}/configure` })} class="shrink-0 text-xs text-link hover:text-link-hover">Configure location</a>
						</div>
					{:else}
						<p class="px-4 py-5 text-sm text-secondary">This sector is empty. Create a system here or move an existing system into it.</p>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<ConfirmDialog bind:this={confirmDialog} />
