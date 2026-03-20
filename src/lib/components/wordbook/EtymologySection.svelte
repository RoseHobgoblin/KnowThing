<script lang="ts">
	import { invalidateAll } from '$app/navigation'
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

	// ── Delete relation ──
	async function deleteRelation(relationId: number) {
		const res = await fetch(`/api/wordbook/${entryId}/relations/${relationId}`, { method: 'DELETE' })
		if (res.ok) invalidateAll()
	}

	// ── Add relation form state ──
	let showForm = $state(false)
	let direction = $state<'from' | 'to'>('from') // 'from' = this word comes from target, 'to' = target comes from this
	let relationType = $state('derived_from')
	let targetQuery = $state('')
	let targetId = $state<number | null>(null)
	let notes = $state('')
	let submitting = $state(false)
	let formError = $state('')
	let searchResults = $state<Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }>>([])
	let showDropdown = $state(false)
	let searchTimeout: ReturnType<typeof setTimeout> | null = null

	const typeLabels: Record<string, string> = {
		derived_from: 'Derived from',
		loan_from: 'Borrowed from',
		compound_of: 'Compound component',
	}
	const reverseTypeLabels: Record<string, string> = {
		derived_from: 'Is ancestor of',
		loan_from: 'Was borrowed by',
		compound_of: 'Used in compound',
	}
	const typeHelp: Record<string, Record<string, string>> = {
		from: {
			derived_from: 'This word evolved from the target word',
			loan_from: 'This word was borrowed from the target word in another language',
			compound_of: 'The target word is one component of this compound — add each component separately',
		},
		to: {
			derived_from: 'The target word evolved from this word',
			loan_from: 'The target word borrowed this word',
			compound_of: 'The target word is a compound that uses this word as a component',
		},
	}

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

	async function addRelation(e: SubmitEvent) {
		e.preventDefault()
		if (!targetId) { formError = 'Select a target word'; return }
		formError = ''
		submitting = true

		// Direction determines who is source vs target
		const sourceId = direction === 'from' ? entryId : targetId
		const tgtId = direction === 'from' ? targetId : entryId

		try {
			const res = await fetch(`/api/wordbook/${sourceId}/relations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetId: tgtId, relationType, notes: notes.trim() || undefined }),
			})
			if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed') }
			targetQuery = ''; targetId = null; notes = ''; showForm = false
			invalidateAll()
		} catch (error: any) { formError = error.message } finally { submitting = false }
	}

	function relationLabel(type: string): string {
		switch (type) {
			case 'derived_from': return 'derived from'
			case 'loan_from': return 'borrowed from'
			case 'compound_of': return 'compound of'
			default: return type
		}
	}
</script>

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
					class="
						inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-page text-link
						transition-colors
						hover:bg-accent-subtle hover:text-link-hover
					"
					title="{step.definition}"
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
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-faint">←</span>
					<span class="text-dim">derived from</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
					<span class="text-faint">({entry.languageName})</span>
					<span class="text-dim text-xs">"{entry.definition}"</span>
					{#if entry.relationNotes}<span class="text-faint text-xs">— {entry.relationNotes}</span>{/if}
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="
							text-red-400 text-xs opacity-0 transition-opacity
							hover:text-red-600
							group-hover:opacity-100
						" title="Remove">×</button>
					{/if}
				</div>
			{/each}

			{#each direct.loanFrom as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-faint">←</span>
					<span class="text-dim">borrowed from</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
					<span class="text-faint">({entry.languageName})</span>
					<span class="text-dim text-xs">"{entry.definition}"</span>
					{#if entry.relationNotes}<span class="text-faint text-xs">— {entry.relationNotes}</span>{/if}
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="
							text-red-400 text-xs opacity-0 transition-opacity
							hover:text-red-600
							group-hover:opacity-100
						" title="Remove">×</button>
					{/if}
				</div>
			{/each}

			{#if direct.compoundOf.length > 0}
				<div class="flex items-baseline gap-2 text-sm mb-1 flex-wrap group">
					<span class="text-faint">←</span>
					<span class="text-dim">compound of</span>
					{#each direct.compoundOf as entry, index}
						{#if index > 0}<span class="text-faint">+</span>{/if}
						<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
						<span class="text-dim text-xs">({entry.definition})</span>
						{#if isAuthenticated}
							<button onclick={() => deleteRelation(entry.relationId)} class="
								text-red-400 text-xs opacity-0 transition-opacity
								hover:text-red-600
								group-hover:opacity-100
							" title="Remove">×</button>
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
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-faint">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link hover:text-link-hover hover:underline">{entry.word}</a>
					{#if entry.partOfSpeech}<span class="text-xs text-faint">({entry.partOfSpeech})</span>{/if}
					<span class="text-dim text-xs">"{entry.definition}"</span>
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="
							text-red-400 text-xs opacity-0 transition-opacity
							hover:text-red-600
							group-hover:opacity-100
						" title="Remove">×</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Borrowed by -->
	{#if direct.loanedTo.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Borrowed by</h3>
			{#each direct.loanedTo as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-faint">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link italic hover:text-link-hover hover:underline">{entry.word}</a>
					<span class="text-faint">({entry.languageName})</span>
					<span class="text-dim text-xs">"{entry.definition}"</span>
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="
							text-red-400 text-xs opacity-0 transition-opacity
							hover:text-red-600
							group-hover:opacity-100
						" title="Remove">×</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Compounds using this -->
	{#if direct.compoundsUsing.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-faint mb-2">Compounds</h3>
			{#each direct.compoundsUsing as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-faint">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-link hover:text-link-hover hover:underline">{entry.word}</a>
					<span class="text-dim text-xs">"{entry.definition}"</span>
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="
							text-red-400 text-xs opacity-0 transition-opacity
							hover:text-red-600
							group-hover:opacity-100
						" title="Remove">×</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Auto-computed cognates -->
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

	<!-- Add relation form (integrated) -->
	{#if isAuthenticated}
		{#if showForm}
			<div class="mt-4 p-4 bg-page rounded-lg border border-border">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Add relation</h4>
					<button onclick={() => showForm = false} class="text-xs text-faint hover:text-secondary">Cancel</button>
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
						<div class="p-2 bg-red-50 border border-red-200 text-red-700 rounded-sm text-xs">{formError}</div>
					{/if}

					<div class="flex gap-3 flex-wrap">
						<select bind:value={relationType} class="
							px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
							focus:outline-none focus:ring-2 focus:ring-accent
						">
							{#each Object.entries(direction === 'from' ? typeLabels : reverseTypeLabels) as [value, label]}
								<option {value}>{label}</option>
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
								class="
									w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
									focus:outline-none focus:ring-2 focus:ring-accent
								"
							/>
							{#if showDropdown}
								<div class="
									absolute z-10 top-full inset-x-0 mt-1 bg-surface border border-border rounded-lg shadow-lg
									max-h-48 overflow-y-auto
								">
									{#each searchResults as result}
										<button type="button" onclick={() => selectTarget(result)} class="
											w-full text-left px-3 py-2 text-sm border-b border-border-subtle
											hover:bg-accent-subtle
											last:border-0
										">
											<span class="font-medium">{result.word}</span>
											<span class="text-faint text-xs ml-1">({result.languageName})</span>
											<span class="text-dim text-xs block">{result.definition}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<p class="text-xs text-faint -mt-1">{typeHelp[direction]?.[relationType] || ''}</p>

					<input type="text" bind:value={notes} placeholder="Notes (optional)" class="
						w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
						focus:outline-none focus:ring-2 focus:ring-accent
					" />

					<button type="submit" disabled={submitting || !targetId} class="
						px-4 py-1.5 bg-accent text-surface rounded-lg text-sm font-medium transition-colors
						hover:bg-accent-hover
						disabled:opacity-50
					">
						{submitting ? 'Adding...' : 'Add'}
					</button>
				</form>
			</div>
		{:else}
			<button onclick={() => showForm = true} class="text-sm text-link hover:text-link-hover hover:underline">
				+ Add etymological relation
			</button>
		{/if}
	{/if}

</div>
{:else if isAuthenticated}
	<!-- No relations yet, but user can add -->
	<div class="text-center py-4">
		<p class="text-sm text-faint mb-2">No etymological relations yet.</p>
		<button onclick={() => showForm = true} class="text-sm text-link hover:text-link-hover hover:underline">
			+ Add etymological relation
		</button>
		{#if showForm}
			<!-- same form, duplicated for the empty state -->
			<div class="mt-4 p-4 bg-page rounded-lg border border-border text-left">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Add relation</h4>
					<button onclick={() => showForm = false} class="text-xs text-faint hover:text-secondary">Cancel</button>
				</div>
				<div class="flex gap-1 mb-3 text-xs">
					<button onclick={() => direction = 'from'} class="px-3 py-1.5 rounded-md transition-colors {direction === 'from' ? 'bg-accent text-surface' : 'bg-surface text-secondary border border-border-strong hover:bg-page'}">This word comes from...</button>
					<button onclick={() => direction = 'to'} class="px-3 py-1.5 rounded-md transition-colors {direction === 'to' ? 'bg-accent text-surface' : 'bg-surface text-secondary border border-border-strong hover:bg-page'}">Another word comes from this...</button>
				</div>
				<form onsubmit={addRelation} class="space-y-3">
					{#if formError}<div class="p-2 bg-red-50 border border-red-200 text-red-700 rounded-sm text-xs">{formError}</div>{/if}
					<div class="flex gap-3 flex-wrap">
						<select bind:value={relationType} class="
							px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
							focus:outline-none focus:ring-2 focus:ring-accent
						">
							{#each Object.entries(direction === 'from' ? typeLabels : reverseTypeLabels) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
						<div class="relative flex-1 min-w-[200px]">
							<input type="text" bind:value={targetQuery} oninput={handleSearch} onfocus={() => { if (searchResults.length > 0) showDropdown = true }} onblur={() => setTimeout(() => showDropdown = false, 200)} placeholder="Search for a word..." class="
								w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
								focus:outline-none focus:ring-2 focus:ring-accent
							" />
							{#if showDropdown}
								<div class="
									absolute z-10 top-full inset-x-0 mt-1 bg-surface border border-border rounded-lg shadow-lg
									max-h-48 overflow-y-auto
								">
									{#each searchResults as result}
										<button type="button" onclick={() => selectTarget(result)} class="
											w-full text-left px-3 py-2 text-sm border-b border-border-subtle
											hover:bg-accent-subtle
											last:border-0
										">
											<span class="font-medium">{result.word}</span><span class="text-faint text-xs ml-1">({result.languageName})</span>
											<span class="text-dim text-xs block">{result.definition}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<input type="text" bind:value={notes} placeholder="Notes (optional)" class="
						w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
						focus:outline-none focus:ring-2 focus:ring-accent
					" />
					<button type="submit" disabled={submitting || !targetId} class="
						px-4 py-1.5 bg-accent text-surface rounded-lg text-sm font-medium transition-colors
						hover:bg-accent-hover
						disabled:opacity-50
					">{submitting ? 'Adding...' : 'Add'}</button>
				</form>
			</div>
		{/if}
	</div>
{/if}
