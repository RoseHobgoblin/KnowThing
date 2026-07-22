<script lang="ts">
	import { untrack } from 'svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import UnitNumberInput from '$lib/components/ui/UnitNumberInput.svelte'
	import LockableDerivedField from '$lib/components/ui/LockableDerivedField.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess } from '$lib/notifications.svelte'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { createDirtyTracker } from '$lib/utils/dirty.svelte'
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

	let saveError = $state('')
	let savedAt = $state<Date | null>(null)


	// Key-sorted so dirty tracking never depends on draft key insertion order.
	function serializeDraft(value: Record<string, any>): string {
		return JSON.stringify(value, Object.keys(value).toSorted())
	}
	const dirty = createDirtyTracker(() => serializeDraft(draft))
	const isDirty = $derived(dirty.isDirty)

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

	// Preset select docked beside the tabs — applying is immediate on pick.
	const presetItems = config.presets
		? [{ value: '', label: config.presets.placeholder }, ...config.presets.names.map(name => ({ value: name, label: name }))]
		: []
	let selectedPreset = $state('')
	$effect(() => {
		const name = selectedPreset
		if (!name) return
		untrack(() => {
			const patch = config.presets?.patch(name)
			if (patch) Object.assign(draft, patch)
			selectedPreset = ''
		})
	})

	const preview = $derived(config.preview ? config.preview(ctx) : null)

	// The computed panel scopes to the active tab's rows by default; the switch
	// widens it to everything derivable about the entity.
	let computedScope = $state<'tab' | 'all'>('tab')
	const computedRows = $derived(
		(config.computed ?? [])
			.filter(row => !config.useTabs || computedScope === 'all' || row.tab == null || row.tab === activeTab)
			.map(row => ({ label: row.label, value: row.compute(ctx) }))
			.filter((row): row is { label: string, value: string } => row.value != null && row.value !== ''),
	)

	function numberRangeError(spec: NumberFieldSpec): string {
		const value = draft[spec.key]
		if (typeof value !== 'number') return ''
		if ((spec.min != null && value < spec.min) || (spec.max != null && value > spec.max)) {
			return spec.rangeError ?? 'Out of range'
		}
		return ''
	}

	const saveMutation = createMutation(() => ({
		mutationFn: () => api<{ slug?: string } | undefined>('PUT', `/api/celestial/${savedSlug}`, buildPayload(config, ctx)),
		onSuccess: (saved) => {
			if (saved?.slug && saved.slug !== savedSlug) {
				draft.slug = saved.slug
				// Update URL without navigation so a later exit uses the new slug
				globalThis.history.replaceState({}, '', globalThis.location.pathname.replace(savedSlug, saved.slug))
				savedSlug = saved.slug
			}

			savedAt = new Date()
			dirty.markClean()
			pushSuccess(`${config.noun} saved`)
		},
		onError: (error) => {
			saveError = error.message
		},
	}))

	const saving = $derived(saveMutation.isPending)

	function save() {
		if (validationIssues.length > 0) {
			saveError = 'Review the highlighted fields before saving.'
			return
		}
		if (slugError) {
			saveError = slugError
			return
		}

		saveError = ''
		saveMutation.mutate()
	}

	const deleteMutation = createMutation(() => ({
		mutationFn: () => api('DELETE', `/api/celestial/${savedSlug}`),
		onSuccess: () => {
			pushSuccess(`${config.noun} deleted`)
			goto(initialParentCrumbs.at(-1)?.href ?? '/celestial')
		},
	}))

	async function deleteEntity() {
		const ok = await confirmDialog.confirm(
			config.deleteConfirm.title,
			config.deleteConfirm.message(initialRecord.name),
			config.deleteConfirm.action,
			'Cancel',
		)
		if (!ok) return

		deleteMutation.mutate()
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
		{#if spec.units}
			<UnitNumberInput
				label={labelOf(spec, ctx)}
				bind:value={draft[spec.key]}
				units={spec.units}
				placeholder={spec.placeholder}
				hint={spec.hint}
				error={numberRangeError(spec)}
			/>
		{:else}
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
		{/if}
	{:else if spec.control === 'select'}
		<Select label={labelOf(spec, ctx)} type="single" bind:value={draft[spec.key]} items={spec.options(ctx)} />
	{:else if spec.control === 'checkbox'}
		<Checkbox bind:value={draft[spec.key]} label={labelOf(spec, ctx)} />
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
	{#snippet actions()}
		<div class="flex items-center gap-3">
			<SaveStatusBadge plain dirty={isDirty} {saving} error={saveError} {savedAt} />
			<Button variant="secondary" href={viewPath}>Cancel</Button>
			<Button onclick={save} disabled={!isDirty} loading={saving}>Save changes</Button>
		</div>
	{/snippet}

	<UnsavedChangesGuard when={isDirty && !saving} />
	<div class="space-y-4">
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

		{#if config.useTabs || config.presets}
			<div class="flex items-center justify-between gap-4">
				{#if config.useTabs}
					<TabNavigation navItems={tabs} bind:activeSectionId={activeTab} size="sm" />
				{:else}
					<div></div>
				{/if}
				{#if config.presets}
					<div class="w-56 shrink-0">
						<Select type="single" bind:value={selectedPreset} items={presetItems} />
					</div>
				{/if}
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-4 items-start lg:grid-cols-[1fr_280px]">
			<div class="space-y-4 min-w-0">
				{#each visibleSections as section (section.id)}
					<section class="bg-surface p-5 space-y-4">
						{#if section.intro}
							<p class="text-xs text-secondary">{section.intro}</p>
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

				{#if config.overrides && config.overrides.length > 0}
					<section class="bg-surface p-5 space-y-4">
						<div>
							<h2 class="text-sm font-semibold text-heading">Overrides</h2>
							<p class="text-xs text-secondary mt-1">
								These values are computed from what you entered above. Unlock one to pin your own value instead — for exotic or magical {config.noun.toLowerCase()}s the physics can't describe.
							</p>
						</div>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							{#each config.overrides as spec (spec.key)}
								{@render fieldControl(spec)}
							{/each}
						</div>
					</section>
				{/if}

				{#if permissions.canManageSettings}
					<section class="border border-error-border bg-error-subtle/40 p-5 space-y-3">
						<div>
							<h2 class="text-sm font-semibold text-error">Danger Zone</h2>
							<p class="text-xs text-secondary mt-1">{config.deleteNote}</p>
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

			<aside class="space-y-4 lg:sticky lg:top-4">
				{#if preview}
					<div class="bg-surface p-4 flex items-center gap-3">
						<span
							class="size-10 rounded-full shrink-0"
							style:background-color={preview.color ?? 'var(--color-border, currentColor)'}
						></span>
						<div class="min-w-0">
							<div class="text-sm font-semibold text-heading truncate">{preview.title}</div>
							{#if preview.subtitle}
								<div class="text-xs text-secondary truncate">{preview.subtitle}</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if config.computed && config.computed.length > 0}
					<div class="bg-surface">
						<div class="px-3 py-2 flex items-center justify-between gap-2 border-b border-border-subtle">
							<h3 class="text-xs font-semibold uppercase tracking-wider text-secondary">Computed properties</h3>
							{#if config.useTabs}
								<div class="flex">
									<button
										type="button"
										onclick={() => computedScope = 'tab'}
										class={cn('px-1.5 py-0.5 text-xs border transition-colors', computedScope === 'tab' ? 'border-accent-border bg-accent-subtle text-accent' : 'border-border-subtle text-secondary hover:text-body')}
									>
										This tab
									</button>
									<button
										type="button"
										onclick={() => computedScope = 'all'}
										class={cn('px-1.5 py-0.5 text-xs border -ml-px transition-colors', computedScope === 'all' ? 'border-accent-border bg-accent-subtle text-accent' : 'border-border-subtle text-secondary hover:text-body')}
									>
										All
									</button>
								</div>
							{/if}
						</div>
						<div class="px-3 py-2.5 space-y-1.5 text-sm">
							{#each computedRows as row (row.label)}
								<div class="flex justify-between gap-4">
									<span class="text-secondary shrink-0">{row.label}</span>
									<span class="text-body text-right font-medium min-w-0">{row.value}</span>
								</div>
							{:else}
								<p class="text-secondary text-xs">Enter values on the left to derive properties.</p>
							{/each}
							{#if computedRows.length > 0}
								<p class="text-secondary text-xs pt-1.5 border-t border-border-subtle">Recalculated live from the values you enter.</p>
							{/if}
						</div>
					</div>
				{/if}
			</aside>
		</div>
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
