<script lang="ts">
	import { untrack } from 'svelte'
	import { createSpaForm } from '$lib/forms/spa-form.svelte.js'
	import { createQuery } from '@tanstack/svelte-query'
	import { useDebounce } from 'runed'
	import { PARTS_OF_SPEECH } from './constants.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { api } from '$lib/api'
	import { cn } from '$lib/utils'
	import { entryFormSchema, toEntryPayload, type EtymRelation } from '$lib/wordbook/entry-form-schema.js'

	let {
		languages = [],
		initial = {},
		initialDefinitions = [],
		submitLabel = 'Save Entry',
		relationsManagedAt = null,
		onsubmit,
	}: {
		languages: Array<{ id: number, name: string, slug: string }>
		initial?: {
			word?: string
			languageId?: number
			pronunciation?: string
			etymology?: string
			notes?: string
			pageSlug?: string
			tags?: string[]
		}
		initialDefinitions?: Array<{
			partOfSpeech?: string | null
			definition?: string
			usageExample?: string | null
			usageTranslation?: string | null
		}>
		submitLabel?: string
		/**
		 * Edit mode: existing relations are managed on the word page
		 * (EtymologySection) — the create-time widget here would silently
		 * discard them. When set, the widget is replaced by a pointer link.
		 */
		relationsManagedAt?: string | null
		onsubmit: (data: Record<string, unknown>) => Promise<void>
	} = $props()

	const initialEntry = $state.snapshot(untrack(() => initial))
	const initialDefinitionRows = $state.snapshot(untrack(() => initialDefinitions))
	const initialValues = {
		word: initialEntry.word || '',
		languageId: initialEntry.languageId ?? 0,
		pronunciation: initialEntry.pronunciation || '',
		etymology: initialEntry.etymology || '',
		notes: initialEntry.notes || '',
		pageSlug: initialEntry.pageSlug || '',
		tagsInput: initialEntry.tags?.join(', ') || '',
		defs: initialDefinitionRows.length > 0
			? initialDefinitionRows.map(d => ({
				partOfSpeech: d.partOfSpeech || '',
				definition: d.definition || '',
				usageExample: d.usageExample || '',
				usageTranslation: d.usageTranslation || '',
			}))
			: [{ partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }],
	}

	// Transient etymology-link search UI; not part of the validated form model.
	// Only selected targets (targetId) become `relations` on submit.
	type EtymRow = { relationType: string, targetId: number | null, query: string, results: Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }>, showDropdown: boolean }

	const spa = createSpaForm({
		schema: entryFormSchema,
		initial: initialValues,
		errorMessage: 'Failed to save',
		onValid: (data) => {
			const relations: EtymRelation[] = etymRows
				.filter((r): r is EtymRow & { targetId: number } => r.targetId !== null)
				.map(r => ({ targetId: r.targetId, relationType: r.relationType }))
			return onsubmit(toEntryPayload(data, relations))
		},
	})
	const { form, errors, enhance, submitting, reset, clearError } = spa

	let etymRows = $state<EtymRow[]>([])
	let searchRowIndex = $state<number | null>(null)
	let debouncedTerm = $state('')

	const etymSearchQuery = createQuery(() => ({
		queryKey: ['wordbook-search', debouncedTerm, 8],
		queryFn: () => api<EtymRow['results']>('GET', `/api/wordbook?q=${encodeURIComponent(debouncedTerm)}&limit=8`),
		enabled: debouncedTerm.length >= 2,
	}))

	$effect(() => {
		if (searchRowIndex === null || etymSearchQuery.data === undefined) return
		const row = etymRows[searchRowIndex]
		if (!row) return
		row.results = etymSearchQuery.data
		row.showDropdown = etymSearchQuery.data.length > 0
	})

	// Adding an etymology row is an intentional edit the tainted tracker can't see.
	const isDirty = $derived(spa.isDirty || etymRows.length > 0)

	const runEtymSearch = useDebounce((index: number, term: string) => {
		searchRowIndex = index
		debouncedTerm = term
	}, 300)

	let languageIdString = $derived($form.languageId ? String($form.languageId) : '')
	function setLanguageId(v: string) {
		$form.languageId = Number(v) || 0
	}

	function addDefinition() {
		$form.defs = [...$form.defs, { partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }]
	}

	function removeDefinition(index: number) {
		if ($form.defs.length <= 1) return
		$form.defs = $form.defs.filter((_, index_) => index_ !== index)
	}

	/** Keyboard-accessible sense reorder; sense numbers are re-derived on save. */
	function moveDefinition(index: number, delta: -1 | 1) {
		const target = index + delta
		if (target < 0 || target >= $form.defs.length) return
		const next = [...$form.defs]
		;[next[index], next[target]] = [next[target], next[index]]
		$form.defs = next
	}

	function addEtymRow() {
		etymRows.push({ relationType: 'derived_from', targetId: null, query: '', results: [], showDropdown: false })
	}

	function removeEtymRow(index: number) {
		searchRowIndex = null
		etymRows = etymRows.filter((_, index_) => index_ !== index)
	}

	function handleEtymSearch(index: number) {
		const row = etymRows[index]
		row.targetId = null
		if (row.query.trim().length < 2) {
			runEtymSearch.cancel()
			row.results = []
			row.showDropdown = false
			return
		}
		runEtymSearch(index, row.query.trim())
	}

	function selectEtymTarget(index: number, r: EtymRow['results'][0]) {
		const row = etymRows[index]
		row.targetId = r.id
		row.query = `${r.word} (${r.languageName})`
		row.showDropdown = false
		searchRowIndex = null
	}

	function discard() {
		clearError()
		etymRows = []
		reset()
	}

	const languageItems = $derived(languages.map(lang => ({ value: String(lang.id), label: lang.name })))
	const posItems = $derived(PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos })))
	const etymRelationItems = [
		{ value: 'derived_from', label: 'Derived from' },
		{ value: 'loan_from', label: 'Borrowed from' },
		{ value: 'compound_of', label: 'Compound of' },
	]

	const labelClass = 'block text-sm font-medium text-secondary mb-1'
</script>

<form method="POST" use:enhance class="space-y-5">
	<UnsavedChangesGuard when={isDirty && !$submitting} />

	{#if spa.submitError}
		<FormNotice title="Wordbook entry was not saved" message={spa.submitError} />
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label="Word" bind:value={$form.word} required placeholder="kirathar" error={$errors.word?.[0]} />
		<div>
			<Select label="Language" value={languageIdString} onValueChange={setLanguageId} type="single" items={languageItems} required placeholder="Select language..." />
			{#if $errors.languageId?.[0]}
				<p class="text-error text-xs mt-1">{$errors.languageId[0]}</p>
			{/if}
		</div>
		<Input label="Pronunciation (IPA)" bind:value={$form.pronunciation} placeholder="/ki.ra.thar/" />
		<Input label="Tags" bind:value={$form.tagsInput} placeholder="religion, astronomy" />
	</div>

	<div>
		<div class="flex items-center justify-between mb-2">
			<div class={labelClass}>Definitions <span class="text-error">*</span></div>
			<button type="button" onclick={addDefinition} class="text-xs text-link hover:text-link-hover hover:underline">+ Add definition</button>
		</div>

		{#if $errors.defs?._errors?.[0]}
			<p class="text-error text-xs mb-2">{$errors.defs._errors[0]}</p>
		{/if}

		{#each $form.defs as def, index (def)}
			<div class={cn('p-3 mb-3 bg-page/50', $form.defs.length > 1 && 'relative')}>
				{#if $form.defs.length > 1}
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-medium text-secondary">Definition {index + 1}</span>
						<span class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => moveDefinition(index, -1)}
								disabled={index === 0}
								aria-label="Move definition {index + 1} up"
								class="text-xs text-link hover:text-link-hover disabled:opacity-30 disabled:cursor-default"
							>↑</button>
							<button
								type="button"
								onclick={() => moveDefinition(index, 1)}
								disabled={index === $form.defs.length - 1}
								aria-label="Move definition {index + 1} down"
								class="text-xs text-link hover:text-link-hover disabled:opacity-30 disabled:cursor-default"
							>↓</button>
							<button type="button" onclick={() => removeDefinition(index)} class="text-xs text-error hover:text-error-hover">Remove</button>
						</span>
					</div>
				{/if}
				<div class="grid grid-cols-1 gap-3 mb-2 md:grid-cols-4">
					<Select bind:value={def.partOfSpeech} type="single" items={posItems} placeholder="Part of speech" size="sm" />
					<Input bind:value={def.definition} placeholder="Definition text..." required={index === 0} containerClass="md:col-span-3" />
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<Input bind:value={def.usageExample} placeholder="Usage example (in the language)" />
					<Input bind:value={def.usageTranslation} placeholder="Translation" />
				</div>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label="Etymology Notes" bind:value={$form.etymology} placeholder="Narrative etymology notes..." />
		<Input label="Wiki Article" bind:value={$form.pageSlug} placeholder="kirathar" />
	</div>

	<div>
		<Input label="Editorial Notes" bind:value={$form.notes} placeholder="Needs verification..." />
	</div>

	{#if relationsManagedAt}
		<div>
			<div class={labelClass}>Etymology Links</div>
			<p class="text-xs text-secondary">
				Relations for this entry are managed in the Etymology section of
				<a href={relationsManagedAt} class="text-link hover:text-link-hover hover:underline">the word page</a>.
			</p>
		</div>
	{:else}
	<div>
		<div class="flex items-center justify-between mb-2">
			<div class={labelClass}>Etymology Links</div>
			<button type="button" onclick={addEtymRow} class="text-xs text-link hover:text-link-hover hover:underline">+ Add source word</button>
		</div>
		{#if etymRows.length === 0}
			<p class="text-xs text-secondary">Click "+ Add source word" to link derivations, loans, or compounds.</p>
		{/if}
		{#each etymRows as row, index (row)}
			<div class="flex gap-2 items-start mb-2">
				<Select bind:value={row.relationType} type="single" items={etymRelationItems} size="sm" />
				<div class="relative flex-1">
					<input
						type="text"
						bind:value={row.query}
						oninput={() => handleEtymSearch(index)}
						onfocus={() => { if (row.results.length > 0) row.showDropdown = true }}
						onblur={() => setTimeout(() => row.showDropdown = false, 200)}
						placeholder="Search for a word..."
						class={cn(
							'w-full px-3 py-1.5 text-sm text-body bg-page outline-none transition-colors placeholder:text-dim focus:ring-2 focus:ring-accent',
							row.targetId && 'bg-success-bg',
						)}
					/>
					{#if row.showDropdown}
						<div class="absolute z-10 top-full inset-x-0 mt-1 bg-surface shadow-lg max-h-40 overflow-y-auto">
							{#each row.results as result (result.id)}
								<button type="button" onclick={() => selectEtymTarget(index, result)} class="w-full text-left px-3 py-1.5 text-sm border-b border-border-subtle hover:bg-accent-subtle last:border-0">
									<span class="font-medium">{result.word}</span>
									<span class="text-secondary text-xs ml-1">({result.languageName})</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<button type="button" onclick={() => removeEtymRow(index)} class="text-error text-sm p-1 hover:text-error-hover">x</button>
			</div>
		{/each}
	</div>
	{/if}

	<StickyActionBar
		dirty={isDirty}
		saving={$submitting}
		error={spa.submitError}
		saveType="submit"
		ondiscard={discard}
		saveLabel={submitLabel}
	/>
</form>
