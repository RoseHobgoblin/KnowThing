<script lang="ts">
	import { PARTS_OF_SPEECH } from './constants.js'

	let {
		languages = [],
		initial = {},
		initialDefinitions = [],
		submitLabel = 'Save Entry',
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
		onsubmit: (data: Record<string, unknown>) => Promise<void>
	} = $props()

	let word = $state(initial.word || '')
	let languageId = $state(initial.languageId || 0)
	let pronunciation = $state(initial.pronunciation || '')
	let etymology = $state(initial.etymology || '')
	let notes = $state(initial.notes || '')
	let pageSlug = $state(initial.pageSlug || '')
	let tagsInput = $state(initial.tags?.join(', ') || '')
	let submitting = $state(false)
	let error = $state('')

	// Definitions
	type DefRow = { partOfSpeech: string, definition: string, usageExample: string, usageTranslation: string }
	let defs = $state<DefRow[]>(
		initialDefinitions.length > 0
			? initialDefinitions.map(d => ({
				partOfSpeech: d.partOfSpeech || '',
				definition: d.definition || '',
				usageExample: d.usageExample || '',
				usageTranslation: d.usageTranslation || '',
			}))
			: [{ partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }],
	)

	function addDefinition() {
		defs = [...defs, { partOfSpeech: '', definition: '', usageExample: '', usageTranslation: '' }]
	}

	function removeDefinition(index: number) {
		if (defs.length <= 1) return
		defs = defs.filter((_, index_) => index_ !== index)
	}

	// Quick etymology relations
	type EtymRow = { relationType: string, targetId: number | null, query: string, results: Array<{ id: number, word: string, definition: string, languageName: string, languageSlug: string }>, showDropdown: boolean }
	let etymRows = $state<EtymRow[]>([])
	let searchTimeouts = new Map<number, ReturnType<typeof setTimeout>>()

	function addEtymRow() {
		etymRows = [...etymRows, { relationType: 'derived_from', targetId: null, query: '', results: [], showDropdown: false }]
	}
	function removeEtymRow(index: number) {
		etymRows = etymRows.filter((_, index_) => index_ !== index)
	}
	function handleEtymSearch(index: number) {
		const row = etymRows[index]
		row.targetId = null
		const existing = searchTimeouts.get(index)
		if (existing) clearTimeout(existing)
		if (row.query.trim().length < 2) { row.results = []; row.showDropdown = false; return }
		searchTimeouts.set(index, setTimeout(async () => {
			const res = await fetch(`/api/wordbook?q=${encodeURIComponent(row.query.trim())}&limit=8`)
			if (res.ok) { row.results = await res.json(); row.showDropdown = row.results.length > 0 }
		}, 300))
	}
	function selectEtymTarget(index: number, r: EtymRow['results'][0]) {
		const row = etymRows[index]
		row.targetId = r.id
		row.query = `${r.word} (${r.languageName})`
		row.showDropdown = false
	}

	const partsOfSpeech = PARTS_OF_SPEECH

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		if (!word.trim() || !languageId) {
			error = 'Word and language are required'
			return
		}
		if (!defs.some(d => d.definition.trim())) {
			error = 'At least one definition is required'
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
				relations: etymRows
					.filter(r => r.targetId)
					.map(r => ({ targetId: r.targetId, relationType: r.relationType })),
			})
		} catch (error_: any) {
			error = error_.message || 'Failed to save'
		} finally {
			submitting = false
		}
	}

	const inputClass = 'w-full px-3 py-2 border border-border-strong rounded-lg text-sm bg-surface text-heading focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border'
	const labelClass = 'block text-sm font-medium text-secondary mb-1'
</script>

<form onsubmit={handleSubmit} class="space-y-5">
	{#if error}
		<div class="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
	{/if}

	<!-- Headword fields -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<label for="word" class={labelClass}>Word <span class="text-red-500">*</span></label>
			<input id="word" type="text" bind:value={word} required class={inputClass} placeholder="kıraŧar" />
		</div>
		<div>
			<label for="language" class={labelClass}>Language <span class="text-red-500">*</span></label>
			<select id="language" bind:value={languageId} required class={inputClass}>
				<option value={0} disabled>Select language...</option>
				{#each languages as lang}
					<option value={lang.id}>{lang.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="pronunciation" class={labelClass}>Pronunciation (IPA)</label>
			<input id="pronunciation" type="text" bind:value={pronunciation} class={inputClass} placeholder="/kɪ.ra.θar/" />
		</div>
		<div>
			<label for="tags" class={labelClass}>Tags <span class="text-xs text-faint">(comma-separated)</span></label>
			<input id="tags" type="text" bind:value={tagsInput} class={inputClass} placeholder="religion, astronomy" />
		</div>
	</div>

	<!-- Definitions -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<label class={labelClass}>Definitions <span class="text-red-500">*</span></label>
			<button type="button" onclick={addDefinition} class="text-xs text-link hover:text-link-hover hover:underline">+ Add definition</button>
		</div>

		{#each defs as def, index}
			<div class="border border-border rounded-lg p-3 mb-3 bg-page/50 {defs.length > 1 ? 'relative' : ''}">
				{#if defs.length > 1}
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-medium text-faint">Definition {index + 1}</span>
						<button type="button" onclick={() => removeDefinition(index)} class="text-xs text-red-400 hover:text-red-600">Remove</button>
					</div>
				{/if}
				<div class="grid grid-cols-1 gap-3 mb-2 md:grid-cols-4">
					<div>
						<select bind:value={def.partOfSpeech} class="
							w-full px-2 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
							focus:outline-none focus:ring-2 focus:ring-accent
						">
							<option value="">Part of speech</option>
							{#each partsOfSpeech as pos}
								<option value={pos}>{pos}</option>
							{/each}
						</select>
					</div>
					<div class="md:col-span-3">
						<input type="text" bind:value={def.definition} placeholder="Definition text..." required={index === 0} class={inputClass} />
					</div>
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<input type="text" bind:value={def.usageExample} placeholder="Usage example (in the language)" class={inputClass} />
					<input type="text" bind:value={def.usageTranslation} placeholder="Translation" class={inputClass} />
				</div>
			</div>
		{/each}
	</div>

	<!-- Etymology, wiki link, notes -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<label for="etymology" class={labelClass}>Etymology Notes</label>
			<input id="etymology" type="text" bind:value={etymology} class={inputClass} placeholder="Narrative etymology notes..." />
		</div>
		<div>
			<label for="pageSlug" class={labelClass}>Wiki Article <span class="text-xs text-faint">(slug)</span></label>
			<input id="pageSlug" type="text" bind:value={pageSlug} class={inputClass} placeholder="kıraŧar" />
		</div>
	</div>

	{#if notes !== undefined}
		<div>
			<label for="notes" class={labelClass}>Editorial Notes</label>
			<input id="notes" type="text" bind:value={notes} class={inputClass} placeholder="Needs verification..." />
		</div>
	{/if}

	<!-- Quick Etymology Links -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<label class={labelClass}>Etymology Links</label>
			<button type="button" onclick={addEtymRow} class="text-xs text-link hover:text-link-hover hover:underline">+ Add source word</button>
		</div>
		{#if etymRows.length === 0}
			<p class="text-xs text-faint">Click "+ Add source word" to link derivations, loans, or compounds. You can also add these on the word's page later.</p>
		{/if}
		{#each etymRows as row, index}
			<div class="flex gap-2 items-start mb-2">
				<select bind:value={row.relationType} class="
					px-2 py-1.5 border border-border-strong rounded-lg text-xs bg-surface
					focus:outline-none focus:ring-2 focus:ring-accent
				">
					<option value="derived_from">Derived from</option>
					<option value="loan_from">Borrowed from</option>
					<option value="compound_of">Compound of</option>
				</select>
				<div class="relative flex-1">
					<input
						type="text"
						bind:value={row.query}
						oninput={() => handleEtymSearch(index)}
						onfocus={() => { if (row.results.length > 0) row.showDropdown = true }}
						onblur={() => setTimeout(() => row.showDropdown = false, 200)}
						placeholder="Search for a word..."
						class="
							w-full px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface
							focus:outline-none focus:ring-2 focus:ring-accent
							{row.targetId ? 'border-green-300 bg-green-50' : ''}"
					/>
					{#if row.showDropdown}
						<div class="
							absolute z-10 top-full inset-x-0 mt-1 bg-surface border border-border rounded-lg shadow-lg
							max-h-40 overflow-y-auto
						">
							{#each row.results as result}
								<button type="button" onclick={() => selectEtymTarget(index, result)} class="
									w-full text-left px-3 py-1.5 text-sm border-b border-border-subtle
									hover:bg-accent-subtle
									last:border-0
								">
									<span class="font-medium">{result.word}</span>
									<span class="text-faint text-xs ml-1">({result.languageName})</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<button type="button" onclick={() => removeEtymRow(index)} class="text-red-400 text-sm p-1 hover:text-red-600">×</button>
			</div>
		{/each}
	</div>

	<div class="pt-2">
		<button type="submit" disabled={submitting} class="
			px-6 py-2.5 bg-accent text-surface rounded-lg font-medium transition-colors
			hover:bg-accent-hover
			disabled:opacity-50
		">
			{submitting ? 'Saving...' : submitLabel}
		</button>
	</div>
</form>
