<script lang="ts">
	import { onDestroy } from 'svelte'
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import { cn } from '$lib/utils'
	import { createMutation, createQuery } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	type RelatedEntry = {
		id: number
		relationId: number
		word: string
		definition: string
		pronunciation: string | null
		partOfSpeech: string | null
		languageName: string
		languageSlug: string
		languageFamily: string | null
		languageColor: string | null
		relationNotes: string | null
	}

	type CognateGroup = {
		family: string
		languages: Array<{
			name: string
			slug: string
			words: Array<{ id: number, word: string, definition: string, pronunciation: string | null }>
		}>
	}

	type EtymologyStep = {
		id: number
		word: string
		definition: string
		languageName: string
		languageSlug: string
		relation: string | null
	}

	let {
		entryId,
		direct,
		cognates = [],
		etymologyChain = [],
		narrativeEtymology = '',
		canEdit = false,
		compact = false,
	}: {
		entryId: number
		direct: {
			derivedFrom: RelatedEntry[]
			loanFrom: RelatedEntry[]
			compoundOf: RelatedEntry[]
			derivedWords: RelatedEntry[]
			loanedTo: RelatedEntry[]
			compoundsUsing: RelatedEntry[]
		}
		cognates?: CognateGroup[]
		etymologyChain?: EtymologyStep[]
		narrativeEtymology?: string
		canEdit?: boolean
		compact?: boolean
	} = $props()

	const hasAnyContent = $derived(
		direct.derivedFrom.length > 0 ||
		direct.loanFrom.length > 0 ||
		direct.compoundOf.length > 0 ||
		direct.derivedWords.length > 0 ||
		direct.loanedTo.length > 0 ||
		direct.compoundsUsing.length > 0 ||
		cognates.length > 0 ||
		etymologyChain.length > 1 ||
		!!narrativeEtymology ||
		canEdit,
	)
	const originChain = $derived(etymologyChain.toReversed())

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	// ── Delete relation ──
	let deleting = $state<number | null>(null)
	const deleteMutation = createMutation(() => ({
		mutationFn: (relationId: number) =>
			api('DELETE', `/api/wordbook/${entryId}/relations/${relationId}`),
	}))
	async function deleteRelation(relationId: number) {
		const ok = await confirmDialog.confirm(m.wbc_remove_relation(), m.wbc_remove_relation_confirm(), m.common_remove(), m.common_cancel())
		if (!ok) return
		deleting = relationId
		try {
			await deleteMutation.mutateAsync(relationId)
			pushSuccess(m.wbc_relation_removed())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_remove_relation())
		}
		deleting = null
	}

	// ── Add relation form ──
	let showForm = $state(false)
	let direction = $state<'from' | 'to'>('from')
	let relationType = $state('derived_from')
	let targetQuery = $state('')
	let targetId = $state<number | null>(null)
	let notes = $state('')
	let formError = $state('')
	type SearchResult = { id: number, word: string, definition: string, languageName: string, languageSlug: string }
	let showDropdown = $state(false)
	let searchTimeout: ReturnType<typeof setTimeout> | null = null
	let debouncedQuery = $state('')

	onDestroy(() => {
		if (searchTimeout) clearTimeout(searchTimeout)
	})

	const typeOptions = $derived.by(() => {
		if (direction === 'from') {
			return [
				{ value: 'derived_from', label: m.wbc_rel_derived_from(), help: m.wbc_rel_help_derived_from() },
				{ value: 'loan_from', label: m.wbc_rel_loan_from(), help: m.wbc_rel_help_loan_from() },
				{ value: 'compound_of', label: m.wbc_rel_compound_of(), help: m.wbc_rel_help_compound_of() },
			]
		}
		return [
			{ value: 'derived_from', label: m.wbc_rel_is_ancestor_of(), help: m.wbc_rel_help_is_ancestor_of() },
			{ value: 'loan_from', label: m.wbc_rel_was_borrowed_by(), help: m.wbc_rel_help_was_borrowed_by() },
			{ value: 'compound_of', label: m.wbc_rel_used_in_compound(), help: m.wbc_rel_help_used_in_compound() },
		]
	})

	const currentHelp = $derived(typeOptions.find(o => o.value === relationType)?.help || '')
	const search = createQuery(() => ({
		queryKey: ['wordbook', 'search', debouncedQuery, 10],
		queryFn: () => api<SearchResult[]>('GET', `/api/wordbook?q=${encodeURIComponent(debouncedQuery)}&limit=10`),
		enabled: debouncedQuery.length >= 2,
	}))
	const searchResults = $derived(search.data ?? [])
	const addMutation = createMutation(() => ({
		mutationFn: ({ sourceId, targetId, relationType, notes }: {
			sourceId: number
			targetId: number
			relationType: string
			notes?: string
		}) => api('POST', `/api/wordbook/${sourceId}/relations`, { targetId, relationType, notes }),
	}))

	function handleSearch() {
		if (searchTimeout) clearTimeout(searchTimeout)
		targetId = null
		if (targetQuery.trim().length < 2) {
			debouncedQuery = ''
			showDropdown = false
			return
		}
		searchTimeout = setTimeout(() => {
			debouncedQuery = targetQuery.trim()
			showDropdown = true
		}, 300)
	}

	function selectTarget(r: typeof searchResults[0]) {
		targetId = r.id
		targetQuery = `${r.word} (${r.languageName})`
		showDropdown = false
	}

	function resetForm() {
		targetQuery = ''
		debouncedQuery = ''
		targetId = null
		notes = ''
		formError = ''
		direction = 'from'
		relationType = 'derived_from'
	}

	function cancelForm() {
		showForm = false
		resetForm()
	}

	async function addRelation(event: SubmitEvent) {
		event.preventDefault()
		if (!targetId) {
			formError = m.wbc_select_target_word()
			return
		}
		formError = ''
		const sourceId = direction === 'from' ? entryId : targetId
		const tgtId = direction === 'from' ? targetId : entryId

		try {
			await addMutation.mutateAsync({ sourceId, targetId: tgtId, relationType, notes: notes.trim() || undefined })
			pushSuccess(m.wbc_relation_added())
			resetForm()
			showForm = false
			await invalidateAll()
		} catch (error) {
			const message = error instanceof Error ? error.message : m.wbc_failed_add_relation()
			formError = message
			pushError(message)
		}
	}
</script>

<!-- Reusable relation entry display -->
{#snippet relationRow(entry: RelatedEntry, arrow: string, label: string)}
	<div class="flex items-baseline gap-2 text-sm mb-1.5 group/rel">
		<span class="text-secondary">{arrow}</span>
		<span class="text-dim text-xs">{label}</span>
		<a href="/Wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
		<span class="text-secondary text-xs">({entry.languageName})</span>
		{#if entry.definition}
			<span class="text-dim text-xs">"{entry.definition}"</span>
		{/if}
		{#if entry.relationNotes}
			<span class="text-secondary text-xs">— {entry.relationNotes}</span>
		{/if}
		{#if canEdit}
			<button
				onclick={() => deleteRelation(entry.relationId)}
				disabled={deleting === entry.relationId}
				class={cn('text-xs text-error transition-colors ml-1 hover:text-error-hover', deleting === entry.relationId && 'opacity-50')}
				title={m.wbc_remove_relation()}
			>✕</button>
		{/if}
	</div>
{/snippet}

<!-- Reusable add-relation form -->
{#snippet addRelationForm()}
	<div class="p-4 bg-page">
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-xs font-medium uppercase tracking-wide text-dim">{m.wbc_add_relation()}</h4>
			<button onclick={cancelForm} class="text-xs text-secondary hover:text-body">{m.common_cancel()}</button>
		</div>

		<!-- Direction toggle -->
		<div class="flex gap-1 mb-3 text-xs">
			<button
				onclick={() => direction = 'from'}
				class={cn('px-3 py-1.5 transition-colors', direction === 'from' ? 'bg-accent text-surface' : 'bg-surface text-secondary hover:bg-page')}
			>{m.wbc_this_word_comes_from()}</button>
			<button
				onclick={() => direction = 'to'}
				class={cn('px-3 py-1.5 transition-colors', direction === 'to' ? 'bg-accent text-surface' : 'bg-surface text-secondary hover:bg-page')}
			>{m.wbc_another_word_comes_from_this()}</button>
		</div>

		<form onsubmit={addRelation} class="space-y-3">
			{#if formError}
				<div class="p-2 bg-error-bg border border-error-border text-error text-xs">{formError}</div>
			{/if}

			<div class="flex gap-3 flex-wrap">
				<Select
					type="single"
					bind:value={relationType}
					items={typeOptions.map(opt => ({ value: opt.value, label: opt.label }))}
					size="sm"
				/>

				<div class="relative flex-1 min-w-50">
					<input
						type="text"
						bind:value={targetQuery}
						oninput={handleSearch}
						onfocus={() => { if (searchResults.length > 0) showDropdown = true }}
						onblur={() => setTimeout(() => showDropdown = false, 200)}
						placeholder={m.wbc_search_word()}
						class="w-full px-3 py-1.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
					/>
					{#if showDropdown}
						<div class="absolute z-10 top-full inset-x-0 mt-1 bg-surface shadow-lg max-h-48 overflow-y-auto">
							{#each searchResults as result (result.id)}
								<button type="button" onclick={() => selectTarget(result)} class="w-full text-left px-3 py-2 text-sm border-b border-border-subtle hover:bg-accent-subtle last:border-0">
									<span class="font-medium">{result.word}</span>
									<span class="text-secondary text-xs ml-1">({result.languageName})</span>
									{#if result.definition}
										<span class="text-dim text-xs block truncate">{result.definition}</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			{#if currentHelp}
				<p class="text-xs text-secondary -mt-1">{currentHelp}</p>
			{/if}

			<Input bind:value={notes} placeholder={m.wbc_notes_optional()} containerClass="w-full" />

			<button type="submit" disabled={addMutation.isPending || !targetId} class="px-4 py-1.5 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">
				{addMutation.isPending ? m.wbc_adding() : m.common_add()}
			</button>
		</form>
	</div>
{/snippet}

{#if hasAnyContent}
<div class={compact ? 'space-y-2' : 'space-y-4'}>

	<!-- Etymology chain breadcrumb -->
	{#if originChain.length > 1}
		<div class="flex items-center gap-1 flex-wrap text-sm">
			{#if !compact}
				<span class="text-xs font-medium uppercase tracking-wide text-secondary mr-1">{m.wbc_lineage()}</span>
			{/if}
			{#each originChain as step, index (step.id)}
				{#if index > 0}
					<span class="text-secondary text-xs">→</span>
				{/if}
				<a
					href="/Wordbook/{step.languageSlug}/{encodeURIComponent(step.word)}"
					class="inline-flex items-center gap-1 px-2 py-0.5 bg-page text-link transition-colors hover:bg-accent-subtle hover:text-link-hover"
					title={step.definition}
				>
					<span class="italic font-medium">{step.word}</span>
					<span class="text-secondary text-xs">({step.languageName})</span>
				</a>
			{/each}
			{#if compact && canEdit}
				<button onclick={() => showForm = true} class="ml-1 text-xs text-link hover:text-link-hover hover:underline">+ {m.wbc_add_relation()}</button>
			{/if}
		</div>
	{/if}

	<!-- Etymology sources -->
	{#if (!compact || etymologyChain.length <= 1) && (direct.derivedFrom.length > 0 || direct.loanFrom.length > 0 || direct.compoundOf.length > 0)}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">{m.wbc_etymology_heading()}</h3>
			{#each direct.derivedFrom as entry (entry.relationId)}
				{@render relationRow(entry, '', m.wbc_this_word_derived_from())}
			{/each}
			{#each direct.loanFrom as entry (entry.relationId)}
				{@render relationRow(entry, '', m.wbc_this_word_borrowed_from())}
			{/each}
			{#if direct.compoundOf.length > 0}
				<div class="flex items-baseline gap-2 text-sm mb-1.5 flex-wrap">
					<span class="text-secondary">←</span>
					<span class="text-dim text-xs">{m.wbc_compound_of_label()}</span>
					{#each direct.compoundOf as entry, index (entry.relationId)}
						{#if index > 0}<span class="text-secondary">+</span>{/if}
						<a href="/Wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
						<span class="text-dim text-xs">({entry.definition})</span>
						{#if canEdit}
							<button onclick={() => deleteRelation(entry.relationId)} disabled={deleting === entry.relationId} class={cn('text-xs text-error hover:text-error-hover', deleting === entry.relationId && 'opacity-50')} title={m.common_remove()}>✕</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Narrative etymology -->
	{#if narrativeEtymology}
		<div>
			{#if direct.derivedFrom.length === 0 && direct.loanFrom.length === 0 && direct.compoundOf.length === 0}
				<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">{m.wbc_etymology_heading()}</h3>
			{/if}
			<p class="text-sm/relaxed text-secondary italic">{narrativeEtymology}</p>
		</div>
	{/if}

	<!-- Derived forms -->
	{#if direct.derivedWords.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">{m.wbc_derived_forms_heading()}</h3>
			{#each direct.derivedWords as entry (entry.relationId)}
				{@render relationRow(entry, '→', entry.partOfSpeech || '')}
			{/each}
		</div>
	{/if}

	<!-- Borrowed by -->
	{#if direct.loanedTo.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">{m.wbc_borrowed_by_heading()}</h3>
			{#each direct.loanedTo as entry (entry.relationId)}
				{@render relationRow(entry, '→', '')}
			{/each}
		</div>
	{/if}

	<!-- Compounds using this -->
	{#if direct.compoundsUsing.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">{m.wbc_compounds_heading()}</h3>
			{#each direct.compoundsUsing as entry (entry.relationId)}
				{@render relationRow(entry, '→', '')}
			{/each}
		</div>
	{/if}

	<!-- Cognates -->
	{#if cognates.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">{m.wbc_cognates_heading()}</h3>
			{#each cognates as group (group.family)}
				<div class="mb-3">
					<div class="text-xs text-secondary font-medium mb-1">{m.wbc_family_label({ family: group.family })}</div>
					{#each group.languages as lang (lang.slug)}
						<div class="flex items-baseline gap-2 text-sm mb-1 ml-3">
							<span class="text-dim min-w-20">{lang.name}:</span>
							{#each lang.words as w, index (w.id)}
								{#if index > 0}<span class="text-secondary">,</span>{/if}
								<a href="/Wordbook/{lang.slug}/{encodeURIComponent(w.word)}" class="text-link italic hover:text-link-hover hover:underline">{w.word}</a>
								<span class="text-secondary text-xs">({w.definition})</span>
							{/each}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add relation -->
	{#if canEdit && (!compact || etymologyChain.length <= 1)}
		{#if showForm}
			{@render addRelationForm()}
		{:else}
			<button onclick={() => showForm = true} class="text-sm text-link hover:text-link-hover hover:underline">
				+ {m.wbc_add_etymological_relation()}
			</button>
		{/if}
	{/if}

</div>
{:else if canEdit}
	<div class="py-4">
		<p class="text-sm text-secondary mb-3">{m.wbc_no_etymological_relations()}</p>
		{#if showForm}
			{@render addRelationForm()}
		{:else}
			<button onclick={() => showForm = true} class="text-sm text-link hover:text-link-hover hover:underline">
				+ {m.wbc_add_etymological_relation()}
			</button>
		{/if}
	</div>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
