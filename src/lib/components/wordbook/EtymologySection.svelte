<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import LanguageBadge from './LanguageBadge.svelte'

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
		isAuthenticated = false,
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
		isAuthenticated?: boolean
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
		isAuthenticated,
	)

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	// ── Delete relation ──
	let deleting = $state<number | null>(null)
	async function deleteRelation(relationId: number) {
		const ok = await confirmDialog.confirm('Remove relation', 'Remove this etymological relation?', 'Remove', 'Cancel')
		if (!ok) return
		deleting = relationId
		const res = await fetch(`/api/wordbook/${entryId}/relations/${relationId}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('Relation removed')
			invalidateAll()
		} else {
			pushError('Failed to remove relation')
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
	let submitting = $state(false)
	let formError = $state('')
	let searchResults = $state<Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }>>([])
	let showDropdown = $state(false)
	let searchTimeout: ReturnType<typeof setTimeout> | null = null

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
		if (targetQuery.trim().length < 2) { searchResults = []; showDropdown = false; return }
		searchTimeout = setTimeout(async () => {
			const res = await fetch(`/api/wordbook?q=${encodeURIComponent(targetQuery.trim())}&limit=10`)
			if (res.ok) { searchResults = await res.json(); showDropdown = searchResults.length > 0 }
		}, 300)
	}

	function selectTarget(r: typeof searchResults[0]) {
		targetId = r.id
		targetQuery = `${r.word} (${r.languageName})`
		showDropdown = false
	}

	function resetForm() {
		targetQuery = ''; targetId = null; notes = ''; formError = ''
		direction = 'from'; relationType = 'derived_from'
	}

	async function addRelation(e: SubmitEvent) {
		e.preventDefault()
		if (!targetId) { formError = 'Select a target word'; return }
		formError = ''
		submitting = true

		const sourceId = direction === 'from' ? entryId : targetId
		const tgtId = direction === 'from' ? targetId : entryId

		try {
			const res = await fetch(`/api/wordbook/${sourceId}/relations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetId: tgtId, relationType, notes: notes.trim() || undefined }),
			})
			if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed') }
			pushSuccess('Relation added')
			resetForm()
			showForm = false
			invalidateAll()
		} catch (error: any) { formError = error.message; pushError(error.message) } finally { submitting = false }
	}
</script>

<!-- Reusable relation entry display -->
{#snippet relationRow(entry: RelatedEntry, arrow: string, label: string)}
	<div class="flex items-baseline gap-2 text-sm mb-1.5 group/rel">
		<span class="text-faint">{arrow}</span>
		<span class="text-dim text-xs">{label}</span>
		<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
		<span class="text-faint text-xs">({entry.languageName})</span>
		{#if entry.definition}
			<span class="text-dim text-xs">"{entry.definition}"</span>
		{/if}
		{#if entry.relationNotes}
			<span class="text-faint text-xs">— {entry.relationNotes}</span>
		{/if}
		{#if isAuthenticated}
			<button
				onclick={() => deleteRelation(entry.relationId)}
				disabled={deleting === entry.relationId}
				class="text-xs text-red-400 hover:text-red-600 transition-colors ml-1 {deleting === entry.relationId ? 'opacity-50' : ''}"
				title="Remove relation"
			>✕</button>
		{/if}
	</div>
{/snippet}

<!-- Reusable add-relation form -->
{#snippet addRelationForm()}
	<div class="p-4 bg-page rounded-lg border border-border">
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Add relation</h4>
			<button onclick={() => { showForm = false; resetForm() }} class="text-xs text-faint hover:text-secondary">Cancel</button>
		</div>

		<!-- Direction toggle -->
		<div class="flex gap-1 mb-3 text-xs">
			<button
				onclick={() => direction = 'from'}
				class="px-3 py-1.5 rounded-md transition-colors {direction === 'from' ? 'bg-accent text-surface' : 'bg-surface text-secondary border border-border-strong hover:bg-page'}"
			>This word comes from...</button>
			<button
				onclick={() => direction = 'to'}
				class="px-3 py-1.5 rounded-md transition-colors {direction === 'to' ? 'bg-accent text-surface' : 'bg-surface text-secondary border border-border-strong hover:bg-page'}"
			>Another word comes from this...</button>
		</div>

		<form onsubmit={addRelation} class="space-y-3">
			{#if formError}
				<div class="p-2 bg-red-50 border border-red-200 text-error rounded-md text-xs">{formError}</div>
			{/if}

			<div class="flex gap-3 flex-wrap">
				<select bind:value={relationType} class="
					px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
					focus:outline-none focus:ring-2 focus:ring-accent
				">
					{#each typeOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>

				<div class="relative flex-1 min-w-[200px]">
					<input
						type="text"
						bind:value={targetQuery}
						oninput={handleSearch}
						onfocus={() => { if (searchResults.length > 0) showDropdown = true }}
						onblur={() => setTimeout(() => showDropdown = false, 200)}
						placeholder="Search for a word..."
						class="w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
					/>
					{#if showDropdown}
						<div class="absolute z-10 top-full inset-x-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
							{#each searchResults as result}
								<button type="button" onclick={() => selectTarget(result)} class="w-full text-left px-3 py-2 text-sm border-b border-border-subtle hover:bg-accent-subtle last:border-0">
									<span class="font-medium">{result.word}</span>
									<span class="text-faint text-xs ml-1">({result.languageName})</span>
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
				<p class="text-xs text-faint -mt-1">{currentHelp}</p>
			{/if}

			<input type="text" bind:value={notes} placeholder="Notes (optional)" class="w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />

			<button type="submit" disabled={submitting || !targetId} class="px-4 py-1.5 bg-accent text-surface rounded-lg text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">
				{submitting ? 'Adding...' : 'Add'}
			</button>
		</form>
	</div>
{/snippet}

{#if hasAnyContent}
<div class="space-y-4">

	<!-- Etymology chain breadcrumb -->
	{#if etymologyChain.length > 1}
		<div class="flex items-center gap-1 flex-wrap text-sm">
			<span class="text-xs font-medium uppercase tracking-wide text-faint mr-1">Origin</span>
			{#each etymologyChain as step, index}
				{#if index > 0}
					<span class="text-faint text-xs">→</span>
				{/if}
				<a
					href="/wordbook/{step.languageSlug}/{encodeURIComponent(step.word)}"
					class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-page text-link transition-colors hover:bg-accent-subtle hover:text-link-hover"
					title={step.definition}
				>
					<span class="italic font-medium">{step.word}</span>
					<span class="text-faint text-xs">({step.languageName})</span>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Etymology sources -->
	{#if direct.derivedFrom.length > 0 || direct.loanFrom.length > 0 || direct.compoundOf.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Etymology</h3>
			{#each direct.derivedFrom as entry}
				{@render relationRow(entry, '←', 'derived from')}
			{/each}
			{#each direct.loanFrom as entry}
				{@render relationRow(entry, '←', 'borrowed from')}
			{/each}
			{#if direct.compoundOf.length > 0}
				<div class="flex items-baseline gap-2 text-sm mb-1.5 flex-wrap">
					<span class="text-faint">←</span>
					<span class="text-dim text-xs">compound of</span>
					{#each direct.compoundOf as entry, index}
						{#if index > 0}<span class="text-faint">+</span>{/if}
						<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
						<span class="text-dim text-xs">({entry.definition})</span>
						{#if isAuthenticated}
							<button onclick={() => deleteRelation(entry.relationId)} disabled={deleting === entry.relationId} class="text-xs text-red-400 hover:text-red-600 {deleting === entry.relationId ? 'opacity-50' : ''}" title="Remove">✕</button>
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
				<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Etymology</h3>
			{/if}
			<p class="text-sm/relaxed text-secondary italic">{narrativeEtymology}</p>
		</div>
	{/if}

	<!-- Derived forms -->
	{#if direct.derivedWords.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Derived forms</h3>
			{#each direct.derivedWords as entry}
				{@render relationRow(entry, '→', entry.partOfSpeech || '')}
			{/each}
		</div>
	{/if}

	<!-- Borrowed by -->
	{#if direct.loanedTo.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Borrowed by</h3>
			{#each direct.loanedTo as entry}
				{@render relationRow(entry, '→', '')}
			{/each}
		</div>
	{/if}

	<!-- Compounds using this -->
	{#if direct.compoundsUsing.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Compounds</h3>
			{#each direct.compoundsUsing as entry}
				{@render relationRow(entry, '→', '')}
			{/each}
		</div>
	{/if}

	<!-- Cognates -->
	{#if cognates.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Cognates</h3>
			{#each cognates as group}
				<div class="mb-3">
					<div class="text-xs text-faint font-medium mb-1">{group.family} family</div>
					{#each group.languages as lang}
						<div class="flex items-baseline gap-2 text-sm mb-1 ml-3">
							<span class="text-dim min-w-20">{lang.name}:</span>
							{#each lang.words as w, index}
								{#if index > 0}<span class="text-faint">,</span>{/if}
								<a href="/wordbook/{lang.slug}/{encodeURIComponent(w.word)}" class="text-link italic hover:text-link-hover hover:underline">{w.word}</a>
								<span class="text-faint text-xs">({w.definition})</span>
							{/each}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add relation -->
	{#if isAuthenticated}
		{#if showForm}
			{@render addRelationForm()}
		{:else}
			<button onclick={() => showForm = true} class="text-sm text-link hover:text-link-hover hover:underline">
				+ Add etymological relation
			</button>
		{/if}
	{/if}

</div>
{:else if isAuthenticated}
	<div class="py-4">
		<p class="text-sm text-faint mb-3">No etymological relations yet.</p>
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
