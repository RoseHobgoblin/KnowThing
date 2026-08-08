<script lang="ts">
	import { untrack } from 'svelte'
	import { m } from '$lib/paraglide/messages.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import UnitNumberInput from '$lib/components/ui/UnitNumberInput.svelte'
	import CoverageInput from '$lib/components/ui/CoverageInput.svelte'
	import LockableDerivedField from '$lib/components/ui/LockableDerivedField.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import CelestialSurfacePreview from '$lib/components/celestial/CelestialSurfacePreview.svelte'
	import MediaAssetPicker from '$lib/components/media/MediaAssetPicker.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
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
	import { surfaceRecipeFromDraft } from '$lib/celestial/surface-editor.js'
	import { weatherRecipeFromDraft } from '$lib/celestial/weather-editor.js'
	import { stellarSurfaceRecipeFromDraft } from '$lib/celestial/stellar-surface-editor.js'
	import { spectralColor } from '$lib/celestial/colors.js'
	import type { MapBody } from '$lib/celestial/system-layout.js'

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
		if (!urlSlugify(slug)) return m.cel_slug_error_empty()
		if (urlSlugify(slug) !== slug) return m.cel_slug_error_format()
		return ''
	})

	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	const entityMutation = createMutation(() => ({
		mutationFn: ({ method, slug, body }: { method: 'PUT' | 'DELETE', slug: string, body?: unknown }) =>
			api<{ slug?: string }>(method, `/api/celestial/${slug}`, body),
	}))
	const saving = $derived(entityMutation.isPending)

	// Recursively key-sort because Media bindings introduce nested draft values.
	function serializeDraft(value: Record<string, any>): string {
		const stable = (input: unknown): unknown => {
			if (Array.isArray(input)) return input.map(stable)
			if (typeof input !== 'object' || input === null) return input
			return Object.fromEntries(
				Object.entries(input as Record<string, unknown>)
					.toSorted(([left], [right]) => left.localeCompare(right))
					.map(([key, nested]) => [key, stable(nested)]),
			)
		}
		return JSON.stringify(stable(value))
	}
	let initialSnapshot = $state(serializeDraft(untrack(() => draft)))
	const currentSnapshot = $derived(serializeDraft(draft))
	const isDirty = $derived(currentSnapshot !== initialSnapshot)
	// Once the record is gone there is nothing left to lose, so the guard must stand down.
	let deleted = $state(false)

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
	const surfacePreviewBody = $derived.by<MapBody | null>(() => {
		if (kind !== 'body') return null
		return {
			id: Number(initialRecord.id ?? 0),
			name: String(draft.name || 'Unnamed body'),
			slug: String(draft.slug || 'unnamed-body'),
			bodyType: String(draft.bodyType || 'planet'),
			temperatureK: typeof draft.temperatureK === 'number' ? draft.temperatureK : null,
			color: typeof initialRecord.color === 'string' ? initialRecord.color : null,
			surface: surfaceRecipeFromDraft(draft),
			weather: weatherRecipeFromDraft(draft),
		}
	})
	const stellarPreviewBody = $derived.by<MapBody | null>(() => {
		if (kind !== 'star') return null
		return {
			id: Number(initialRecord.id ?? 0),
			name: String(draft.name || 'Unnamed star'),
			slug: String(draft.slug || 'unnamed-star'),
			bodyType: 'star',
			isStar: true,
			spectralType: typeof draft.spectralType === 'string' ? draft.spectralType : null,
			temperatureK: typeof draft.temperatureK === 'number' ? draft.temperatureK : null,
			rotationPeriodS: typeof draft.rotationPeriodS === 'number' ? draft.rotationPeriodS : null,
			color: spectralColor(
				typeof draft.spectralType === 'string' ? draft.spectralType : null,
				typeof draft.color === 'string' ? draft.color : null,
			),
			stellarSurface: stellarSurfaceRecipeFromDraft(draft),
		}
	})

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
			return spec.rangeError ?? m.cel_out_of_range()
		}
		return ''
	}

	async function save() {
		if (validationIssues.length > 0) {
			saveError = m.cel_review_fields()
			return
		}
		if (slugError) {
			saveError = slugError
			return
		}

		saveError = ''
		try {
			const saved = await entityMutation.mutateAsync({
				method: 'PUT', slug: savedSlug, body: buildPayload(config, ctx),
			})
			if (saved?.slug && saved.slug !== savedSlug) {
				draft.slug = saved.slug
				// Update URL without navigation so a later exit uses the new slug
				globalThis.history.replaceState({}, '', globalThis.location.pathname.replace(savedSlug, saved.slug))
				savedSlug = saved.slug
			}

			savedAt = new Date()
			initialSnapshot = currentSnapshot
			pushSuccess(m.cel_noun_saved({ name: config.noun }))
		} catch (error) {
			saveError = error instanceof Error ? error.message : m.cel_failed_save()
			pushError(saveError)
		}
	}

	async function deleteEntity() {
		const ok = await confirmDialog.confirm(
			config.deleteConfirm.title,
			config.deleteConfirm.message(initialRecord.name),
			config.deleteConfirm.action,
			m.common_cancel(),
		)
		if (!ok) return

		try {
			await entityMutation.mutateAsync({ method: 'DELETE', slug: savedSlug })
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.cel_failed_delete_noun({ name: config.noun.toLowerCase() }))
			return
		}

		deleted = true
		pushSuccess(m.cel_noun_deleted({ name: config.noun }))
		const parentHref = initialParentCrumbs.at(-1)?.href
		if (parentHref?.startsWith('/Celestial:')) {
			await goto(resolve('/[...ns_path=namespaced]', { ns_path: parentHref.slice(1) }))
		} else {
			await goto(resolve('/celestial'))
		}
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
				disabled={spec.disabled?.(ctx) ?? false}
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
				disabled={spec.disabled?.(ctx) ?? false}
			/>
		{/if}
	{:else if spec.control === 'coverage'}
		<CoverageInput
			label={labelOf(spec, ctx)}
			hint={spec.hint ?? ''}
			domain={spec.domain}
			disabled={spec.disabled?.(ctx) ?? false}
			disabledReason={spec.disabledReason}
			bind:value={draft[spec.key]}
		/>
	{:else if spec.control === 'select'}
		<Select label={labelOf(spec, ctx)} type="single" bind:value={draft[spec.key]} items={spec.options(ctx)} disabled={spec.disabled?.(ctx) ?? false} />
	{:else if spec.control === 'checkbox'}
		<Checkbox bind:value={draft[spec.key]} label={labelOf(spec, ctx)} />
	{:else if spec.control === 'media'}
		<MediaAssetPicker
			label={labelOf(spec, ctx)}
			hint={spec.hint}
			purpose={spec.purpose}
			canUpload={permissions.canManageMedia}
			bind:value={draft[spec.key]}
		/>
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
	title={m.cel_configure_named({ name: initialRecord.name })}
>
	{#snippet actions()}
		<div class="flex items-center gap-3">
			<SaveStatusBadge plain dirty={isDirty} {saving} error={saveError} {savedAt} />
			<Button variant="secondary" href={viewPath}>{m.common_cancel()}</Button>
			<Button onclick={save} disabled={!isDirty} loading={saving}>{m.cel_save_changes()}</Button>
		</div>
	{/snippet}

	<UnsavedChangesGuard when={isDirty && !saving && !deleted} />
	<div class="space-y-4">
		{#if saveError}
			<FormNotice title={m.cel_changes_not_saved({ name: config.noun })} message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title={m.cel_draft_needs_attention({ name: config.noun })} messages={validationIssues} />
		{/if}
		{#if physicsWarnings.length > 0}
			<FormNotice
				tone="warning"
				title={m.cel_physics_plausibility()}
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

		<div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_280px]">
			<div class="min-w-0 space-y-4">
				{#each visibleSections as section (section.id)}
					<section class="space-y-4 bg-surface p-5">
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
					<section class="space-y-4 bg-surface p-5">
						<div>
							<h2 class="text-sm font-semibold text-heading">{m.cel_overrides()}</h2>
							<p class="mt-1 text-xs text-secondary">
								{m.cel_overrides_help({ name: config.noun.toLowerCase() })}
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
					<section class="bg-error-subtle/40 space-y-3 border border-error-border p-5">
						<div>
							<h2 class="text-sm font-semibold text-error">{m.common_danger_zone()}</h2>
							<p class="mt-1 text-xs text-secondary">{config.deleteNote}</p>
						</div>
						<div>
							<Button variant="danger" onclick={deleteEntity}>{config.deleteConfirm.action}</Button>
						</div>
					</section>
				{/if}
			</div>

			<aside class="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
				{#if surfacePreviewBody}
					<CelestialSurfacePreview body={surfacePreviewBody} />
				{:else if stellarPreviewBody}
					<CelestialSurfacePreview body={stellarPreviewBody} isStar />
				{:else if preview}
					<div class="flex items-center gap-3 bg-surface p-4">
						<span
							class="size-10 shrink-0 rounded-full"
							style:background-color={preview.color ?? 'var(--color-border, currentColor)'}
						></span>
						<div class="min-w-0">
							<div class="truncate text-sm font-semibold text-heading">{preview.title}</div>
							{#if preview.subtitle}
								<div class="truncate text-xs text-secondary">{preview.subtitle}</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if config.computed && config.computed.length > 0}
					<div class="bg-surface">
						<div class="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
							<h3 class="text-xs font-semibold tracking-wider uppercase">{m.cel_computed_properties()}</h3>
							{#if config.useTabs}
								<div class="flex shrink-0">
									<button
										type="button"
										onclick={() => computedScope = 'tab'}
										class={cn('border px-1 py-0.5 text-xs whitespace-nowrap transition-colors', computedScope === 'tab' ? 'border-accent-border bg-accent-subtle text-accent' : 'border-border-subtle text-secondary hover:text-body')}
									>
										{m.cel_this_tab()}
									</button>
									<button
										type="button"
										onclick={() => computedScope = 'all'}
										class={cn('-ml-px border px-1 py-0.5 text-xs whitespace-nowrap transition-colors', computedScope === 'all' ? 'border-accent-border bg-accent-subtle text-accent' : 'border-border-subtle text-secondary hover:text-body')}
									>
										{m.common_all()}
									</button>
								</div>
							{/if}
						</div>
						<div class="space-y-1.5 px-3 py-2.5 text-sm">
							{#each computedRows as row (row.label)}
								<div class="flex justify-between gap-4">
									<span class="shrink-0 text-secondary">{row.label}</span>
									<span class="min-w-0 text-right font-medium text-body">{row.value}</span>
								</div>
							{:else}
								<p class="text-xs text-secondary">{m.cel_enter_values()}</p>
							{/each}
							{#if computedRows.length > 0}
								<p class="border-t border-border-subtle pt-1.5 text-xs text-secondary">{m.cel_recalculated_live()}</p>
							{/if}
						</div>
					</div>
				{/if}
			</aside>
		</div>
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
