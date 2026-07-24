<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import WorkedInflectionExample from './WorkedInflectionExample.svelte'
	import { generateCellKeys, cellKeyLabel } from '$lib/wordbook/cell-keys.js'
	import { applyStem } from '$lib/wordbook/inflection-pattern.js'
	import { cn } from '$lib/utils'
	import { createMutation, createQuery } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let {
		entryId,
		word = '',
		inflection,
		availableClasses = [],
		languageSlug = '',
		partOfSpeech = '',
	}: {
		entryId: number
		word?: string
		languageSlug?: string
		partOfSpeech?: string
		inflection: {
			dimensions: Array<{ id: number, name: string, values: string[], sortOrder: number }>
			forms: Record<string, string>
			overrides: Record<string, string>
			className: string | null
			stem: string | null
			hasInflection: boolean
		}
		availableClasses: Array<{ id: number, name: string, partOfSpeech: string }>
	} = $props()

	const filteredClasses = $derived(
		partOfSpeech
			? availableClasses.filter(c => c.partOfSpeech === partOfSpeech)
			: availableClasses,
	)

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let editing = $state(false)
	let selectedClassId = $state<number | null>(null)
	let stem = $state('')
	let overrides = $state<Record<string, string>>({})
	let error = $state('')

	// Rules for the currently selected class — fetched on demand for live preview
	const classRulesQuery = createQuery(() => ({
		queryKey: ['languages', languageSlug, 'inflection-classes', selectedClassId],
		queryFn: () => api<{ rules?: Array<{ cellKey: string, pattern: string }> }>(
			'GET', `/api/languages/${languageSlug}/inflections/classes/${selectedClassId}`,
		),
		enabled: editing && selectedClassId != null,
	}))
	const selectedClassRules = $derived(Object.fromEntries(
		(classRulesQuery.data?.rules ?? []).map(rule => [rule.cellKey, rule.pattern]),
	))
	const loadingRules = $derived(classRulesQuery.isFetching)
	const saveMutation = createMutation(() => ({
		mutationFn: (body: { classId: number | null, stem: string | null, overrides: Record<string, string> }) =>
			api('PUT', `/api/wordbook/${entryId}/inflection`, body),
	}))
	const saving = $derived(saveMutation.isPending)

	function startEditing() {
		selectedClassId = null
		stem = inflection.stem || ''
		overrides = { ...inflection.overrides }

		if (inflection.className) {
			const match = filteredClasses.find(c => c.name === inflection.className)
			if (match) selectedClassId = match.id
		}

		editing = true
	}

	async function save() {
		error = ''
		try {
			await saveMutation.mutateAsync({
				classId: selectedClassId || null,
				stem: stem.trim() || null,
				overrides: Object.fromEntries(
					Object.entries(overrides).filter(([_, v]) => v.trim()),
				),
			})
			pushSuccess(m.wbc_inflection_saved())
			editing = false
			await invalidateAll()
		} catch (error_) {
			const message = error_ instanceof Error ? error_.message : m.wbc_failed_save()
			error = message
			pushError(message)
		}
	}

	async function removeInflection() {
		const ok = await confirmDialog.confirm(m.wbc_remove_inflection(), m.wbc_remove_inflection_confirm(), m.common_remove(), m.common_cancel())
		if (!ok) return
		try {
			await saveMutation.mutateAsync({ classId: null, stem: null, overrides: {} })
			pushSuccess(m.wbc_inflection_removed())
		} catch (error_) {
			pushError(error_ instanceof Error ? error_.message : m.wbc_failed_remove_inflection())
		}
		editing = false
		await invalidateAll()
	}

	const cellKeys = $derived(
		generateCellKeys(inflection.dimensions.map(d => ({ values: d.values, sortOrder: d.sortOrder }))),
	)

	// Smart stem placeholder: try to strip the longest non-{stem} suffix
	// from any rule pattern off the headword.
	const stemPlaceholder = $derived.by(() => {
		if (!word) return m.wbc_eg_value({ value: 'cat' })
		const patterns = Object.values(selectedClassRules)
		if (patterns.length === 0) return word
		let best = word
		for (const pattern of patterns) {
			const index = pattern.indexOf('{stem}')
			if (index === -1) continue
			const suffix = pattern.slice(index + '{stem}'.length)
			if (suffix && word.endsWith(suffix)) {
				const candidate = word.slice(0, word.length - suffix.length)
				if (candidate.length < best.length && candidate.length > 0) best = candidate
			}
		}
		return best
	})

	// Live preview: apply rules to the current stem (or placeholder fallback)
	const previewStem = $derived(stem.trim() || stemPlaceholder)
	const livePreview = $derived.by(() => {
		const out: Array<{ cell: string, form: string }> = []
		for (const key of cellKeys) {
			const override = overrides[key]?.trim()
			const pattern = selectedClassRules[key]
			if (override) out.push({ cell: key, form: override })
			else if (pattern) out.push({ cell: key, form: applyStem(pattern, previewStem) })
		}
		return out
	})

	// What the rule alone would generate for an override row
	function ruleWouldBe(key: string): string {
		const pattern = selectedClassRules[key]
		if (!pattern) return ''
		return applyStem(pattern, previewStem)
	}

	const inputClass = 'px-2 py-1 text-sm bg-page focus:outline-none focus:ring-2 focus:ring-accent'
</script>

{#if editing}
	<div class="mt-4 p-4 bg-raised space-y-3">
		<div class="flex items-center justify-between">
			<h4 class="text-xs font-medium uppercase tracking-wide text-dim">{m.wbc_set_up_inflection()}</h4>
			<div class="flex gap-2">
				{#if inflection.hasInflection}
					<button onclick={removeInflection} class="text-xs text-error hover:underline">{m.common_remove()}</button>
				{/if}
				<button onclick={() => editing = false} class="text-xs text-secondary hover:text-body">{m.common_cancel()}</button>
			</div>
		</div>

		<WorkedInflectionExample compact />

		{#if error}
			<div class="p-2 bg-error-bg border border-error-border text-error text-xs">{error}</div>
		{/if}

		<div class="flex gap-3 flex-wrap">
			<!-- Paradigm class -->
			<div class="flex-1 min-w-50">
				<span class="block text-xs font-medium text-secondary mb-1">{m.wbc_paradigm_class()}</span>
				{#if filteredClasses.length > 0}
					<Select
						type="single"
						numeric
						bind:value={selectedClassId}
						placeholder={m.wbc_manual_no_class()}
						items={filteredClasses.map(cls => ({ value: String(cls.id), label: cls.name }))}
						containerClass="w-full"
					/>
					<p class="text-xs text-secondary mt-1">{m.wbc_paradigm_class_help()}</p>
				{:else}
					<div class="p-2 bg-warning-bg border border-warning-border text-xs text-body">
						{#if availableClasses.length > 0}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
							{@html m.wbc_no_classes_for_pos({ pos: partOfSpeech || m.wbc_this_part_of_speech() })}
							<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">{m.wbc_inflections_link()}</a>.
						{:else if inflection.dimensions.length > 0}
							{m.wbc_no_classes_defined()}
							<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">{m.wbc_create_a_class()}</a>{m.wbc_then_come_back_assign()}
						{:else}
							{m.wbc_no_inflection_system()}
							<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">{m.wbc_add_dimensions()}</a>
							{m.wbc_add_dimensions_suffix()}
						{/if}
					</div>
				{/if}
			</div>

			<!-- Stem -->
			<div class="flex-1 min-w-37.5">
				<span class="block text-xs font-medium text-secondary mb-1">{m.wbc_stem()}</span>
				<Input bind:value={stem} containerClass="w-full" placeholder={m.wbc_eg_value({ value: stemPlaceholder })} />
				<p class="text-xs text-secondary mt-1">{m.wbc_stem_help()}</p>
			</div>
		</div>

		{#if selectedClassId !== null && livePreview.length > 0}
			<div class="p-2 bg-page">
				<div class="text-xs text-dim mb-1">{m.wbc_will_generate()}</div>
				<div class="text-xs font-mono text-body flex flex-wrap gap-x-3 gap-y-0.5">
					{#each livePreview as cell (cell.cell)}
						<span><span class="text-secondary">{cellKeyLabel(cell.cell)}:</span> {cell.form}</span>
					{/each}
				</div>
			</div>
		{:else if selectedClassId !== null && loadingRules}
			<div class="text-xs text-secondary">{m.wbc_loading_class_rules()}</div>
		{/if}

		<!-- Override grid -->
		{#if cellKeys.length > 0}
			<div>
				<span class="block text-xs font-medium text-secondary mb-1">
					{m.wbc_irregular_forms()}
				</span>
				<p class="text-xs text-secondary mb-2">{m.wbc_irregular_forms_help()}</p>
				<div class="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
					{#each cellKeys as key (key)}
						{@const generated = ruleWouldBe(key)}
						{@const hasOverride = (overrides[key] ?? '').trim().length > 0}
						<div class="flex items-center gap-2">
							<span class="text-xs text-secondary w-32 truncate" title={key}>{cellKeyLabel(key)}</span>
							<input
								type="text"
								value={overrides[key] || ''}
								oninput={(event) => {
									const value = (event.target as HTMLInputElement).value
									if (value.trim()) {
										overrides[key] = value
									} else {
										const { [key]: _, ...rest } = overrides
										overrides = rest
									}
								}}
								placeholder={generated || '—'}
								class={cn('flex-1', inputClass, 'text-xs', hasOverride && 'border-accent bg-accent-subtle')}
							/>
							{#if hasOverride && generated}
								<span class="text-xs text-secondary whitespace-nowrap" title={m.wbc_rule_would_generate()}>{m.wbc_would_be({ form: generated })}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<button
			onclick={save}
			disabled={saving}
			class="px-4 py-1.5 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50"
		>
			{saving ? m.common_saving() : m.wbc_save_inflection()}
		</button>
	</div>
{:else if !inflection.hasInflection}
	<button onclick={startEditing} class="mt-3 text-sm text-link hover:text-link-hover hover:underline">
		+ {m.wbc_set_up_inflection()}
	</button>
{:else}
	<button onclick={startEditing} class="mt-1 text-xs text-secondary hover:text-link hover:underline">
		{m.wbc_edit_inflection()}
	</button>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
