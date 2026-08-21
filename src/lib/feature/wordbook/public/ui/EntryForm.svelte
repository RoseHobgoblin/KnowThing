<script lang="ts">
	import { onDestroy, untrack } from 'svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import { PARTS_OF_SPEECH } from './constants.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { useQueryClient } from '@tanstack/svelte-query'
	import { searchWordbook } from '../wordbook-client.js'
	import { cn } from '$lib/utils'
	import { m } from '$lib/paraglide/messages.js'

	let {
		languages = [],
		initial = {},
		initialDefinitions = [],
		submitLabel = m.wbc_save_entry(),
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
		languageIdStr: initialEntry.languageId ? String(initialEntry.languageId) : '',
		pronunciation: initialEntry.pronunciation || '',
		etymology: initialEntry.etymology || '',
		notes: initialEntry.notes || '',
		pageSlug: initialEntry.pageSlug || '',
		tagsInput: initialEntry.tags?.join(', ') || '',
	}
	const resolvedDefinitionRows = initialDefinitionRows.length > 0
		? initialDefinitionRows.map(d => ({
			partOfSpeech: d.partOfSpeech || '',
			definition: d.definition || '',
			usageExample: d.usageExample || '',
			usageTranslation: d.usageTranslation || '',
		}))
		: [{ partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }]

	type DefinitionRow = { partOfSpeech: string, definition: string, usageExample: string, usageTranslation: string }
	type EtymRow = { relationType: string, targetId: number | null, query: string, results: Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }>, showDropdown: boolean }

	let word = $state(initialValues.word)
	let languageIdString = $state(initialValues.languageIdStr)
	let languageId = $derived(Number(languageIdString) || 0)
	let pronunciation = $state(initialValues.pronunciation)
	let etymology = $state(initialValues.etymology)
	let notes = $state(initialValues.notes)
	let pageSlug = $state(initialValues.pageSlug)
	let tagsInput = $state(initialValues.tagsInput)
	let submitting = $state(false)
	let error = $state('')

	let defs = $state<DefinitionRow[]>(resolvedDefinitionRows)

	let etymRows = $state<EtymRow[]>([])
	const searchTimeouts = new SvelteMap<number, ReturnType<typeof setTimeout>>()
	const queryClient = useQueryClient()

	const currentSnapshot = $derived(JSON.stringify({ word, languageIdStr: languageIdString, pronunciation, etymology, notes, pageSlug, tagsInput, defs, etymRows }))
	const initialSnapshot = JSON.stringify({
		...initialValues,
		defs: resolvedDefinitionRows,
		etymRows: [],
	})
	const isDirty = $derived(currentSnapshot !== initialSnapshot)

	onDestroy(() => {
		for (const timer of searchTimeouts.values()) clearTimeout(timer)
	})

	function addDefinition() {
		defs = [...defs, { partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }]
	}

	function removeDefinition(index: number) {
		if (defs.length <= 1) return
		defs = defs.filter((_, index_) => index_ !== index)
	}

	/** Keyboard-accessible sense reorder; sense numbers are re-derived on save. */
	function moveDefinition(index: number, delta: -1 | 1) {
		const target = index + delta
		if (target < 0 || target >= defs.length) return
		const next = [...defs]
		;[next[index], next[target]] = [next[target], next[index]]
		defs = next
	}

	function addEtymRow() {
		etymRows.push({ relationType: 'derived_from', targetId: null, query: '', results: [], showDropdown: false })
	}

	function removeEtymRow(index: number) {
		etymRows = etymRows.filter((_, index_) => index_ !== index)
	}

	function handleEtymSearch(index: number) {
		const row = etymRows[index]
		row.targetId = null
		const existing = searchTimeouts.get(index)
		if (existing) clearTimeout(existing)
		if (row.query.trim().length < 2) {
			row.results = []
			row.showDropdown = false
			return
		}
		searchTimeouts.set(index, setTimeout(async () => {
			row.results = await queryClient.fetchQuery({
				queryKey: ['wordbook', 'search', row.query.trim(), 8],
				queryFn: () => searchWordbook<EtymRow['results']>(row.query.trim(), 8),
			})
			row.showDropdown = row.results.length > 0
		}, 300))
	}

	function selectEtymTarget(index: number, r: EtymRow['results'][0]) {
		const row = etymRows[index]
		row.targetId = r.id
		row.query = `${r.word} (${r.languageName})`
		row.showDropdown = false
	}

	function resetForm() {
		word = initialValues.word
		languageIdString = initialValues.languageIdStr
		pronunciation = initialValues.pronunciation
		etymology = initialValues.etymology
		notes = initialValues.notes
		pageSlug = initialValues.pageSlug
		tagsInput = initialValues.tagsInput
		defs = resolvedDefinitionRows
		etymRows = []
		error = ''
	}

	const languageItems = $derived(languages.map(lang => ({ value: String(lang.id), label: lang.name })))
	const posItems = $derived(PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos })))
	const etymRelationItems = [
		{ value: 'derived_from', label: m.wbc_rel_derived_from() },
		{ value: 'loan_from', label: m.wbc_rel_loan_from() },
		{ value: 'compound_of', label: m.wbc_rel_compound_of() },
	]

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		if (!word.trim() || !languageId) {
			error = m.wbc_word_language_required()
			return
		}
		if (!defs.some(d => d.definition.trim())) {
			error = m.wbc_definition_at_least_one()
			return
		}

		error = ''
		submitting = true
		try {
			await onsubmit({
				word: word.trim(),
				languageId,
				pronunciation: pronunciation.trim() || undefined,
				etymology: etymology.trim() || undefined,
				notes: notes.trim() || undefined,
				pageSlug: pageSlug.trim() || undefined,
				tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
				defs: defs.filter(d => d.definition.trim()).map(d => ({
					partOfSpeech: d.partOfSpeech || undefined,
					definition: d.definition.trim(),
					usageExample: d.usageExample.trim() || undefined,
					usageTranslation: d.usageTranslation.trim() || undefined,
				})),
				relations: etymRows.filter(r => r.targetId).map(r => ({ targetId: r.targetId, relationType: r.relationType })),
			})
		} catch (error_: any) {
			error = error_.message || m.wbc_failed_save()
		} finally {
			submitting = false
		}
	}

	const labelClass = 'block text-sm font-medium text-secondary mb-1'
</script>

<form onsubmit={handleSubmit} class="space-y-5">
	<UnsavedChangesGuard when={isDirty && !submitting} />

	{#if error}
		<FormNotice title={m.wbc_entry_not_saved()} message={error} />
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label={m.wbc_word()} bind:value={word} required placeholder="kirathar" error={!word.trim() && error ? m.wbc_word_required() : ''} />
		<Select label={m.wbc_language()} bind:value={languageIdString} type="single" items={languageItems} required placeholder={m.wbc_select_language()} />
		<Input label={m.wbc_pronunciation_ipa()} bind:value={pronunciation} placeholder="/ki.ra.thar/" />
		<Input label={m.wbc_tags()} bind:value={tagsInput} placeholder="religion, astronomy" />
	</div>

	<div>
		<div class="flex items-center justify-between mb-2">
			<div class={labelClass}>{m.wbc_definitions()} <span class="text-error">*</span></div>
			<button type="button" onclick={addDefinition} class="text-xs text-link hover:text-link-hover hover:underline">+ {m.wbc_add_definition()}</button>
		</div>

		{#each defs as row, index (row)}
			<div class={cn('p-3 mb-3 bg-page/50', defs.length > 1 && 'relative')}>
				{#if defs.length > 1}
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-medium text-secondary">{m.wbc_definition_n({ count: index + 1 })}</span>
						<span class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => moveDefinition(index, -1)}
								disabled={index === 0}
								aria-label={m.wbc_move_definition_up({ count: index + 1 })}
								class="text-xs text-link hover:text-link-hover disabled:opacity-30 disabled:cursor-default"
							>↑</button>
							<button
								type="button"
								onclick={() => moveDefinition(index, 1)}
								disabled={index === defs.length - 1}
								aria-label={m.wbc_move_definition_down({ count: index + 1 })}
								class="text-xs text-link hover:text-link-hover disabled:opacity-30 disabled:cursor-default"
							>↓</button>
							<button type="button" onclick={() => removeDefinition(index)} class="text-xs text-error hover:text-error-hover">{m.common_remove()}</button>
						</span>
					</div>
				{/if}
				<div class="grid grid-cols-1 gap-3 mb-2 md:grid-cols-4">
					<Select bind:value={row.partOfSpeech} type="single" items={posItems} placeholder={m.wbc_part_of_speech()} size="sm" />
					<Input bind:value={row.definition} placeholder={m.wbc_definition_text()} required={index === 0} containerClass="md:col-span-3" error={!row.definition.trim() && error ? m.wbc_definition_required() : ''} />
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<Input bind:value={row.usageExample} placeholder={m.wbc_usage_example()} />
					<Input bind:value={row.usageTranslation} placeholder={m.wbc_translation()} />
				</div>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label={m.wbc_etymology_notes()} bind:value={etymology} placeholder={m.wbc_etymology_notes_placeholder()} />
		<Input label={m.wbc_wiki_article()} bind:value={pageSlug} placeholder="kirathar" />
	</div>

	<div>
		<Input label={m.wbc_editorial_notes()} bind:value={notes} placeholder={m.wbc_editorial_notes_placeholder()} />
	</div>

	{#if relationsManagedAt}
		<div>
			<div class={labelClass}>{m.wbc_etymology_links()}</div>
			<p class="text-xs text-secondary">
				{m.wbc_relations_managed_prefix()}
				<a href={relationsManagedAt} class="text-link hover:text-link-hover hover:underline">{m.wbc_relations_managed_link()}</a>.
			</p>
		</div>
	{:else}
	<div>
		<div class="flex items-center justify-between mb-2">
			<div class={labelClass}>{m.wbc_etymology_links()}</div>
			<button type="button" onclick={addEtymRow} class="text-xs text-link hover:text-link-hover hover:underline">+ {m.wbc_add_source_word()}</button>
		</div>
		{#if etymRows.length === 0}
			<p class="text-xs text-secondary">{m.wbc_add_source_word_hint()}</p>
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
						placeholder={m.wbc_search_word()}
						class={cn(
							'w-full px-3 py-1.5 text-sm text-body bg-page outline-none transition-colors',
							'placeholder:text-dim',
							'focus:ring-2 focus:ring-accent',
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
		saving={submitting}
		error={error}
		saveType="submit"
		ondiscard={resetForm}
		saveLabel={submitLabel}
	/>
</form>
