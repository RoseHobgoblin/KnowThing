<script lang="ts">
	import { untrack } from 'svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { updateSystemSchema } from '$lib/celestial/schema.js'
	import { summarizeZodIssues } from '$lib/utils.js'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import { urlSlugify } from '$lib/utils/slugify.js'

	type CelestialCrumb = { label: string, href: string }
	type SystemRecord = {
		id: number
		name: string
		slug: string
		systemType?: string | null
		description?: string | null
		distanceLy?: number | null
		galacticX?: number | null
		galacticY?: number | null
		galacticZ?: number | null
		formationAge?: string | null
		designations?: string | null
	}

	type SystemDraftSnapshot = {
		name: string
		slug: string
		description: string
		distanceLy: number | null
		galacticX: number | null
		galacticY: number | null
		galacticZ: number | null
		formationAge: string
		designations: string
	}

	function buildInitialDraft(record: SystemRecord): SystemDraftSnapshot {
		return {
			name: record.name,
			slug: record.slug,
			description: record.description ?? '',
			distanceLy: record.distanceLy ?? null,
			galacticX: record.galacticX ?? null,
			galacticY: record.galacticY ?? null,
			galacticZ: record.galacticZ ?? null,
			formationAge: record.formationAge ?? '',
			designations: record.designations ?? '',
		}
	}

	let {
		system,
		parentCrumbs = [],
	}: {
		system: SystemRecord
		parentCrumbs?: CelestialCrumb[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const initialSystem = $state.snapshot(untrack(() => system))
	const initialParentCrumbs = $state.snapshot(untrack(() => parentCrumbs))
	const initialDraft = buildInitialDraft(initialSystem)

	// The slug the server currently knows this system by — updated after each save
	// so consecutive renames PUT to the right URL.
	let savedSlug = $state(initialSystem.slug)
	const viewPath = $derived(`/Celestial:${savedSlug}`)

	let name = $state(initialDraft.name)
	let slug = $state(initialDraft.slug)
	// Once the slug is edited by hand it stops following the name.
	let slugEdited = $state(false)
	const slugError = $derived.by(() => {
		if (!urlSlugify(slug)) return 'Slug must contain at least one letter or number'
		if (urlSlugify(slug) !== slug) return 'Use lowercase letters, numbers and hyphens only'
		return ''
	})
	let description = $state(initialDraft.description)
	let distanceLy = $state<number | null>(initialDraft.distanceLy)
	let galacticX = $state<number | null>(initialDraft.galacticX)
	let galacticY = $state<number | null>(initialDraft.galacticY)
	let galacticZ = $state<number | null>(initialDraft.galacticZ)
	let formationAge = $state(initialDraft.formationAge)
	let designations = $state(initialDraft.designations)

	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)

	function serialize(snapshot: SystemDraftSnapshot): string {
		return JSON.stringify(snapshot)
	}

	let initialSnapshot = $state(serialize(initialDraft))
	const currentSnapshot = $derived(serialize({
		name,
		slug,
		description,
		distanceLy,
		galacticX,
		galacticY,
		galacticZ,
		formationAge,
		designations,
	}))
	const isDirty = $derived(currentSnapshot !== initialSnapshot)

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	const validationIssues = $derived.by(() => {
		const parsed = updateSystemSchema.safeParse({
			name,
			description,
			distanceLy,
			galacticX,
			galacticY,
			galacticZ,
			formationAge: formationAge || null,
			designations: designations || null,
		})
		if (parsed.success) return []
		return summarizeZodIssues(parsed.error)
	})

	function resetDraft() {
		name = initialDraft.name
		slug = initialDraft.slug
		slugEdited = false
		description = initialDraft.description
		distanceLy = initialDraft.distanceLy
		galacticX = initialDraft.galacticX
		galacticY = initialDraft.galacticY
		galacticZ = initialDraft.galacticZ
		formationAge = initialDraft.formationAge
		designations = initialDraft.designations
		saveError = ''
	}

	async function save() {
		if (validationIssues.length > 0) {
			saveError = 'Review the highlighted fields before saving.'
			return
		}
		if (slugError) {
			saveError = slugError
			return
		}

		saving = true
		saveError = ''
		try {
			const response = await fetch(`/api/star-systems/${savedSlug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					slug,
					description,
					distanceLy,
					galacticX,
					galacticY,
					galacticZ,
					formationAge: formationAge || null,
					designations: designations || null,
				}),
			})
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				saveError = payload.error || 'Failed to save system'
				pushError(saveError)
				return
			}

			const saved = await response.json().catch(() => null)
			if (saved?.slug && saved.slug !== savedSlug) {
				slug = saved.slug
				// Update URL without navigation so save-and-exit uses the new slug
				globalThis.history.replaceState({}, '', globalThis.location.pathname.replace(savedSlug, saved.slug))
				savedSlug = saved.slug
			}

			savedAt = new Date()
			initialSnapshot = currentSnapshot
			pushSuccess('System saved')
		} catch {
			saveError = 'Failed to save'
			pushError('Failed to save')
		} finally {
			saving = false
		}
	}

	async function saveAndExit() {
		await save()
		if (!saveError) goto(viewPath)
	}

	async function deleteSystem() {
		const ok = await confirmDialog.confirm(
			'Delete star system',
			`Delete "${initialSystem.name}"? This cannot be undone. Stars in this system will be unassigned, not deleted.`,
			'Delete System',
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/star-systems/${savedSlug}`, { method: 'DELETE' })
		if (!response.ok) {
			const payload = await response.json().catch(() => ({}))
			pushError(payload.error || 'Failed to delete system')
			return
		}

		pushSuccess('System deleted')
		goto(initialParentCrumbs.at(-1)?.href ?? '/celestial')
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(initialParentCrumbs, { name: initialSystem.name, slug: initialSystem.slug })}
	title="Configure {initialSystem.name}"
>
	<UnsavedChangesGuard when={isDirty && !saving} />
	<div class="space-y-6">
		<div class="flex items-center justify-between gap-3 bg-surface border border-border px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-heading">Configure System</h2>
				<p class="text-xs text-faint">The system type is derived from the number of stars — assign stars to change it.</p>
			</div>
			<SaveStatusBadge dirty={isDirty} {saving} error={saveError} {savedAt} />
		</div>

		{#if saveError}
			<FormNotice title="System changes were not saved" message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title="System draft needs attention" messages={validationIssues} />
		{/if}

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Name" bind:value={name} placeholder="System name" oninput={() => { if (!slugEdited) slug = urlSlugify(name) }} />
				<Input label="Slug" bind:value={slug} placeholder="system-slug" error={slugError} oninput={() => { slugEdited = true }} hint="URL identifier (/Celestial:slug). Follows the name until edited by hand. Existing [[links]] to the old slug are not redirected." />
				<Input label="Designations" bind:value={designations} placeholder="Alt. names, catalog IDs" hint="Alternate names or catalogue identifiers, comma-separated." />
			</div>
			<Input label="Description" bind:value={description} placeholder="Brief description..." />
		</section>

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<p class="text-xs text-faint">Placement in the setting. Distance and formation age are shown on the system page; coordinates are stored for a future galaxy map.</p>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Distance (ly)" type="number" bind:value={distanceLy} step="any" placeholder="4.24" hint="Distance from the reference point, in light-years." />
				<Input label="Formation Age" bind:value={formationAge} placeholder="~4.6 billion years" hint="When the system formed. Free text." />
				<div></div>
				<Input label="Galactic X (ly)" type="number" bind:value={galacticX} step="any" placeholder="0.0" hint="Coordinate on the setting's galactic map. Optional." />
				<Input label="Galactic Y (ly)" type="number" bind:value={galacticY} step="any" placeholder="0.0" hint="Coordinate on the setting's galactic map. Optional." />
				<Input label="Galactic Z (ly)" type="number" bind:value={galacticZ} step="any" placeholder="0.0" hint="Coordinate on the setting's galactic map. Optional." />
			</div>
		</section>

		<div class="space-y-3">
			<StickyActionBar
				dirty={isDirty}
				{saving}
				error={saveError}
				{savedAt}
				saveType="button"
				onsave={save}
				onsaveandexit={saveAndExit}
				ondiscard={resetDraft}
				cancelHref={viewPath}
			/>
		</div>

		{#if permissions.canManageSettings}
			<section class="border border-error-border bg-error-subtle/40 p-5 space-y-3">
				<div>
					<h2 class="text-sm font-semibold text-error">Danger Zone</h2>
					<p class="text-xs text-faint mt-1">Delete this star system record. Stars in it are unassigned, not deleted.</p>
				</div>
				<div>
					<button
						type="button"
						onclick={deleteSystem}
						class="px-4 py-2 text-sm border border-error-border text-error hover:bg-error-subtle"
					>
						Delete System
					</button>
				</div>
			</section>
		{/if}
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
