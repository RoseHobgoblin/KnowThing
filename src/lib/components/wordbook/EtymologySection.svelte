<script lang="ts">
	import { onDestroy } from 'svelte'
	import { invalidateAll } from '$app/navigation'
	import { createMutation, createQuery } from '@tanstack/svelte-query'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import { cn } from '$lib/utils'
	import { api } from '$lib/api'

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

	const onError = (error: Error) => pushError(error.message)

	// ── Delete relation ──
	const deleteRelationMutation = createMutation(() => ({
		mutationFn: (relationId: number) => api('DELETE', `/api/wordbook/${entryId}/relations/${relationId}`),
		onSuccess: () => {
			pushSuccess('Relation removed')
			invalidateAll()
		},
		onError,
	}))

	const deleting = $derived(deleteRelationMutation.isPending ? deleteRelationMutation.variables : null)

	async function deleteRelation(relationId: number) {
		const ok = await confirmDialog.confirm('Remove relation', 'Remove this etymological relation?', 'Remove', 'Cancel')
		if (ok) deleteRelationMutation.mutate(relationId)
	}

	// ── Add relation form ──
	let showForm = $state(false)
	let direction = $state<'from' | 'to'>('from')
	let relationType = $state('derived_from')
	let targetQuery = $state('')
	let targetId = $state<number | null>(null)
	let notes = $state('')
	let formError = $state('')
	let debouncedQuery = $state('')
	let dropdownOpen = $state(false)
	let searchTimeout: ReturnType<typeof setTimeout> | null = null

	const searchQuery = createQuery(() => ({
		queryKey: ['wordbook-search', debouncedQuery, 10],
		queryFn: () => api<Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }>>('GET', `/api/wordbook?q=${encodeURIComponent(debouncedQuery)}&limit=10`),
		enabled: debouncedQuery.length >= 2,
		placeholderData: (previous: Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }> | undefined) => previous,
	}))

	const searchResults = $derived(searchQuery.data ?? [])
	const showDropdown = $derived(dropdownOpen && searchResults.length > 0)

	onDestroy(() => {
		if (searchTimeout) clearTimeout(searchTimeout)
	})

	const typeOptions = $derived.by(() => {
		if (direction === 'from') {
			return [
				{ value: 'derived_from', label: 'Derived from', help: 'This word evolved from the target word' },
				{ value: 'loan_from', label: 'Borrowed from', help: 'This word was borrowed from the target word' },
				{ value: 'compound_of', label: 'Compound of', help: 'The target word is a component of this compound' },
			]
		}
		return [
			{ value: 'derived_from', label: 'Is ancestor of', help: 'The target word evolved from this word' },
			{ value: 'loan_from', label: 'Was borrowed by', help: 'The target word borrowed this word' },
			{ value: 'compound_of', label: 'Used in compound', help: 'The target word is a compound using this word' },
		]
	})

	const currentHelp = $derived(typeOptions.find(o => o.value === relationType)?.help || '')

	function handleSearch() {
		if (searchTimeout) clearTimeout(searchTimeout)
		targetId = null
		if (targetQuery.trim().length < 2) {
			debouncedQuery = ''
			dropdownOpen = false
			return
		}
		dropdownOpen = true
		searchTimeout = setTimeout(() => {
			debouncedQuery = targetQuery.trim()
		}, 300)
	}

	function selectTarget(r: typeof searchResults[0]) {
		targetId = r.id
		targetQuery = `${r.word} (${r.languageName})`
		dropdownOpen = false
	}

	function resetForm() {
		targetQuery = ''
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

	const addRelationMutation = createMutation(() => ({
		mutationFn: ({ sourceId, targetId: tgtId }: { sourceId: number, targetId: number }) =>
			api('POST', `/api/wordbook/${sourceId}/relations`, { targetId: tgtId, relationType, notes: notes.trim() || undefined }),
		onSuccess: () => {
			pushSuccess('Relation added')
			resetForm()
			showForm = false
			invalidateAll()
		},
		onError: (error: Error) => {
			formError = error.message
			pushError(error.message)
		},
	}))

	const submitting = $derived(addRelationMutation.isPending)

	function addRelation(event: SubmitEvent) {
		event.preventDefault()
		if (!targetId) {
			formError = 'Select a target word'
			return
		}
		formError = ''
		addRelationMutation.mutate({
			sourceId: direction === 'from' ? entryId : targetId,
			targetId: direction === 'from' ? targetId : entryId,
		})
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
				title="Remove relation"
			>✕</button>
		{/if}
	</div>
{/snippet}

<!-- Reusable add-relation form -->
{#snippet addRelationForm()}
	<div class="p-4 bg-page">
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Add relation</h4>
			<button onclick={cancelForm} class="text-xs text-secondary hover:text-body">Cancel</button>
		</div>

		<!-- Direction toggle -->
		<div class="flex gap-1 mb-3 text-xs">
			<button
				onclick={() => direction = 'from'}
				class={cn('px-3 py-1.5 transition-colors', direction === 'from' ? 'bg-accent text-surface' : 'bg-surface text-secondary hover:bg-page')}
			>This word comes from...</button>
			<button
				onclick={() => direction = 'to'}
				class={cn('px-3 py-1.5 transition-colors', direction === 'to' ? 'bg-accent text-surface' : 'bg-surface text-secondary hover:bg-page')}
			>Another word comes from this...</button>
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
						onfocus={() => { if (searchResults.length > 0) dropdownOpen = true }}
						onblur={() => setTimeout(() => dropdownOpen = false, 200)}
						placeholder="Search for a word..."
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

			<Input bind:value={notes} placeholder="Notes (optional)" containerClass="w-full" />

			<button type="submit" disabled={submitting || !targetId} class="px-4 py-1.5 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">
				{submitting ? 'Adding...' : 'Add'}
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
				<span class="text-xs font-medium uppercase tracking-wide text-secondary mr-1">Lineage</span>
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
				<button onclick={() => showForm = true} class="ml-1 text-xs text-link hover:text-link-hover hover:underline">+ Add relation</button>
			{/if}
		</div>
	{/if}

	<!-- Etymology sources -->
	{#if (!compact || etymologyChain.length <= 1) && (direct.derivedFrom.length > 0 || direct.loanFrom.length > 0 || direct.compoundOf.length > 0)}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Etymology</h3>
			{#each direct.derivedFrom as entry (entry.relationId)}
				{@render relationRow(entry, '', 'This word is derived from')}
			{/each}
			{#each direct.loanFrom as entry (entry.relationId)}
				{@render relationRow(entry, '', 'This word is borrowed from')}
			{/each}
			{#if direct.compoundOf.length > 0}
				<div class="flex items-baseline gap-2 text-sm mb-1.5 flex-wrap">
					<span class="text-secondary">←</span>
					<span class="text-dim text-xs">compound of</span>
					{#each direct.compoundOf as entry, index (entry.relationId)}
						{#if index > 0}<span class="text-secondary">+</span>{/if}
						<a href="/Wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
						<span class="text-dim text-xs">({entry.definition})</span>
						{#if canEdit}
							<button onclick={() => deleteRelation(entry.relationId)} disabled={deleting === entry.relationId} class={cn('text-xs text-error hover:text-error-hover', deleting === entry.relationId && 'opacity-50')} title="Remove">✕</button>
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
				<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Etymology</h3>
			{/if}
			<p class="text-sm/relaxed text-secondary italic">{narrativeEtymology}</p>
		</div>
	{/if}

	<!-- Derived forms -->
	{#if direct.derivedWords.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Derived forms</h3>
			{#each direct.derivedWords as entry (entry.relationId)}
				{@render relationRow(entry, '→', entry.partOfSpeech || '')}
			{/each}
		</div>
	{/if}

	<!-- Borrowed by -->
	{#if direct.loanedTo.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Borrowed by</h3>
			{#each direct.loanedTo as entry (entry.relationId)}
				{@render relationRow(entry, '→', '')}
			{/each}
		</div>
	{/if}

	<!-- Compounds using this -->
	{#if direct.compoundsUsing.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Compounds</h3>
			{#each direct.compoundsUsing as entry (entry.relationId)}
				{@render relationRow(entry, '→', '')}
			{/each}
		</div>
	{/if}

	<!-- Cognates -->
	{#if cognates.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Cognates</h3>
			{#each cognates as group (group.family)}
				<div class="mb-3">
					<div class="text-xs text-secondary font-medium mb-1">{group.family} family</div>
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
				+ Add etymological relation
			</button>
		{/if}
	{/if}

</div>
{:else if canEdit}
	<div class="py-4">
		<p class="text-sm text-secondary mb-3">No etymological relations yet.</p>
		{#if showForm}
			{@render addRelationForm()}
		{:else}
			<button onclick={() => showForm = true} class="text-sm text-link hover:text-link-hover hover:underline">
				+ Add etymological relation
			</button>
		{/if}
	</div>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
