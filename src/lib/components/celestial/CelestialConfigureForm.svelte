<script lang="ts">
	import { untrack } from 'svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import DerivedField from '$lib/components/ui/DerivedField.svelte'
	import LockableDerivedField from '$lib/components/ui/LockableDerivedField.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { cn, summarizeZodIssues } from '$lib/utils.js'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import {
		CELESTIAL_FORM_CONFIGS,
		allFieldSpecs,
		buildDraft,
		buildPayload,
		labelOf,
		lockFlagKey,
		type CelestialFormKind,
		type FieldContext,
		type FieldSpec,
		type NumberFieldSpec,
		type SelectFieldSpec,
		type SystemReferenceOption,
		type StarReferenceOption,
		type BodyReferenceOption,
	} from '$lib/celestial/form-registry.js'

	type CelestialCrumb = { label: string, href: string }

	let {
		kind,
		record,
		systems = [],
		stars = [],
		siblings = [],
		parentCrumbs = [],
	}: {
		kind: CelestialFormKind
		record: Record<string, any>
		systems?: SystemReferenceOption[]
		stars?: StarReferenceOption[]
		siblings?: BodyReferenceOption[]
		parentCrumbs?: CelestialCrumb[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const config = CELESTIAL_FORM_CONFIGS[untrack(() => kind)]
	const initialRecord = $state.snapshot(untrack(() => record)) as Record<string, any>
	const initialParentCrumbs = $state.snapshot(untrack(() => parentCrumbs))

	const clearableSelects = allFieldSpecs(config)
		.filter((spec): spec is SelectFieldSpec => spec.control === 'select' && !!spec.clearIfInvalid)

	let draft = $state(buildDraft(config, initialRecord))
	// Reference lists stay live (they come from the loader), the record is frozen
	// at mount like the previous per-kind forms did.
	const ctx = $derived<FieldContext>({ draft, selfId: initialRecord.id ?? null, systems, stars, siblings })

	// The slug the server currently knows this entity by — updated after each save
	// so consecutive renames PUT to the right URL. Canonical URLs are flat
	// /Celestial:Slug — parent path is for breadcrumbs only.
	let savedSlug = $state(initialRecord.slug as string)
	const viewPath = $derived(`/Celestial:${savedSlug}`)

	// Once the slug is edited by hand it stops following the name.
	let slugEdited = $state(false)
	const slugError = $derived.by(() => {
		const slug = String(draft.slug ?? '')
		if (!urlSlugify(slug)) return 'Slug must contain at least one letter or number'
		if (urlSlugify(slug) !== slug) return 'Use lowercase letters, numbers and hyphens only'
		return ''
	})

	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)

	// Key-sorted so dirty tracking never depends on draft key insertion order.
	function serializeDraft(value: Record<string, any>): string {
		return JSON.stringify(value, Object.keys(value).toSorted())
	}
	let initialSnapshot = $state(serializeDraft(untrack(() => draft)))
	const currentSnapshot = $derived(serializeDraft(draft))
	const isDirty = $derived(currentSnapshot !== initialSnapshot)

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	const validationIssues = $derived.by(() => {
		const parsed = config.updateSchema.safeParse(buildPayload(config, ctx))
		if (parsed.success) return []
		return summarizeZodIssues(parsed.error)
	})
	const physicsWarnings = $derived(config.physicsWarnings ? config.physicsWarnings(ctx) : [])

	// Clear a parent selection when its option list changes out from under it
	// (e.g. the system/star choice changed, or the parent became a descendant).
	$effect(() => {
		for (const spec of clearableSelects) {
			const value = draft[spec.key]
			if (!value) continue
			if (!spec.options(ctx).some(item => item.value === value)) draft[spec.key] = ''
		}
	})

	const tabs = config.sections.map(section => ({ id: section.id, label: section.label }))
	let activeTab = $state(config.sections[0].id)
	const visibleSections = $derived(config.useTabs
		? config.sections.filter(section => section.id === activeTab)
		: config.sections)

	const presetItems = config.presets
		? [{ value: '', label: config.presets.placeholder }, ...config.presets.names.map(name => ({ value: name, label: name }))]
		: []
	let selectedPreset = $state('')
	function applyPreset() {
		const patch = config.presets?.patch(selectedPreset)
		if (patch) Object.assign(draft, patch)
	}

	function numberRangeError(spec: NumberFieldSpec): string {
		const value = draft[spec.key]
		if (typeof value !== 'number') return ''
		if ((spec.min != null && value < spec.min) || (spec.max != null && value > spec.max)) {
			return spec.rangeError ?? 'Out of range'
		}
		return ''
	}

	function resetDraft() {
		draft = buildDraft(config, initialRecord)
		slugEdited = false
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
			const response = await fetch(`/api/celestial/${savedSlug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload(config, ctx)),
			})
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				saveError = payload.error || `Failed to save ${config.noun.toLowerCase()}`
				pushError(saveError)
				return
			}

			const saved = await response.json().catch(() => null)
			if (saved?.slug && saved.slug !== savedSlug) {
				draft.slug = saved.slug
				// Update URL without navigation so save-and-exit uses the new slug
				globalThis.history.replaceState({}, '', globalThis.location.pathname.replace(savedSlug, saved.slug))
				savedSlug = saved.slug
			}

			savedAt = new Date()
			initialSnapshot = currentSnapshot
			pushSuccess(`${config.noun} saved`)
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

	async function deleteEntity() {
		const ok = await confirmDialog.confirm(
			config.deleteConfirm.title,
			config.deleteConfirm.message(initialRecord.name),
			config.deleteConfirm.action,
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/celestial/${savedSlug}`, { method: 'DELETE' })
		if (!response.ok) {
			const payload = await response.json().catch(() => ({}))
			pushError(payload.error || `Failed to delete ${config.noun.toLowerCase()}`)
			return
		}

		pushSuccess(`${config.noun} deleted`)
		goto(initialParentCrumbs.at(-1)?.href ?? '/celestial')
	}
</script>

{#snippet fieldControl(spec: FieldSpec)}
	{#if spec.control === 'name'}
		<Input
			label={labelOf(spec, ctx)}
			bind:value={draft.name}
			placeholder={spec.placeholder}
			oninput={() => { if (!slugEdited) draft.slug = urlSlugify(String(draft.name ?? '')) }}
		/>
	{:else if spec.control === 'slug'}
		<Input
			label={labelOf(spec, ctx)}
			bind:value={draft.slug}
			placeholder={spec.placeholder}
			error={slugError}
			oninput={() => { slugEdited = true }}
			hint={spec.hint}
		/>
	{:else if spec.control === 'text'}
		<Input label={labelOf(spec, ctx)} bind:value={draft[spec.key]} placeholder={spec.placeholder} hint={spec.hint} />
	{:else if spec.control === 'number'}
		<Input
			label={labelOf(spec, ctx)}
			type="number"
			step="any"
			bind:value={draft[spec.key]}
			min={spec.min}
			max={spec.max}
			placeholder={spec.placeholder}
			hint={spec.hint}
			error={numberRangeError(spec)}
		/>
	{:else if spec.control === 'select'}
		<Select label={labelOf(spec, ctx)} type="single" bind:value={draft[spec.key]} items={spec.options(ctx)} />
	{:else if spec.control === 'checkbox'}
		<Checkbox bind:value={draft[spec.key]} label={labelOf(spec, ctx)} />
	{:else if spec.control === 'derived'}
		{#if !spec.visible || spec.visible(ctx)}
			<DerivedField label={labelOf(spec, ctx)} value={spec.compute(ctx)} hint={spec.hint} />
		{/if}
	{:else if spec.control === 'lockable'}
		<LockableDerivedField
			label={labelOf(spec, ctx)}
			derivedValue={spec.derive(ctx)}
			bind:value={draft[spec.key]}
			bind:unlocked={draft[lockFlagKey(spec.key)]}
			type={spec.valueType ?? 'text'}
			step={spec.valueType === 'number' ? 'any' : undefined}
			placeholder={spec.placeholder}
			hint={spec.hint}
		/>
	{/if}
{/snippet}

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(initialParentCrumbs, { name: initialRecord.name, slug: initialRecord.slug })}
	title="Configure {initialRecord.name}"
>
	<UnsavedChangesGuard when={isDirty && !saving} />
	<div class="space-y-6">
		<div class="flex items-center justify-between gap-3 bg-surface border border-border px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-heading">Configure {config.noun}</h2>
				<p class="text-xs text-faint">{config.headerNote}</p>
			</div>
			<SaveStatusBadge dirty={isDirty} {saving} error={saveError} {savedAt} />
		</div>

		{#if config.presets}
			<section class="bg-accent-subtle/30 border border-accent-border/50 p-4 flex flex-col gap-2 sm:flex-row sm:items-end">
				<div class="flex-1">
					<Select label="Populate from real-world data" type="single" bind:value={selectedPreset} items={presetItems} />
				</div>
				<button
					type="button"
					disabled={!selectedPreset}
					onclick={applyPreset}
					class="px-4 py-2 text-sm border border-accent-border text-accent hover:bg-accent-subtle disabled:opacity-40 disabled:cursor-not-allowed"
				>
					Apply
				</button>
			</section>
		{/if}

		{#if saveError}
			<FormNotice title="{config.noun} changes were not saved" message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title="{config.noun} draft needs attention" messages={validationIssues} />
		{/if}
		{#if physicsWarnings.length > 0}
			<FormNotice
				tone="warning"
				title="Physics plausibility"
				messages={physicsWarnings.map(w => `${w.severity === 'impossible' ? '🚫' : '⚠️'} ${w.message}`)}
			/>
		{/if}

		{#if config.useTabs}
			<TabNavigation navItems={tabs} bind:activeSectionId={activeTab} fullWidth size="sm" />
		{/if}

		{#each visibleSections as section (section.id)}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				{#if section.intro}
					<p class="text-xs text-faint">{section.intro}</p>
				{/if}
				{#each section.groups as group, groupIndex (groupIndex)}
					{#if group.cols === 1}
						{#each group.fields as spec, specIndex (specIndex)}
							{@render fieldControl(spec)}
						{/each}
					{:else}
						<div class={cn('grid grid-cols-1 gap-4', group.cols === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
							{#each group.fields as spec, specIndex (specIndex)}
								{@render fieldControl(spec)}
							{/each}
						</div>
					{/if}
				{/each}
			</section>
		{/each}

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
					<p class="text-xs text-faint mt-1">{config.deleteNote}</p>
				</div>
				<div>
					<button
						type="button"
						onclick={deleteEntity}
						class="px-4 py-2 text-sm border border-error-border text-error hover:bg-error-subtle"
					>
						{config.deleteConfirm.action}
					</button>
				</div>
			</section>
		{/if}
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
